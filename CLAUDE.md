# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite dev server (no env vars required)
npm run build      # vue-tsc type-check + vite build — run this to verify types; there is no separate lint step
npm run preview    # Preview a production build
npm run test       # Vitest (watch mode); use `npm run test -- run` for a single pass in CI
npm run test -- run test/helper.test.js          # Run one test file
npm run test -- run -t "name of test"            # Run tests matching a name
```

There is no ESLint config; type safety is enforced by `vue-tsc` via `npm run build`. `tsconfig.json` is strict with `noUnusedLocals`/`noUnusedParameters`, so unused imports/vars fail the build.

Test files live in `test/` and are plain `.test.js` (not co-located with source).

## Architecture

Fantasy Football Wrapped (ffwrapped.com) is a Vue 3 + TypeScript + Vite SPA that analyzes Sleeper and ESPN fantasy leagues. It is **client-heavy**: nearly all data fetching and analytics happen in the browser. The only server code is a thin Vercel serverless proxy. AI features call external backend endpoints (Supabase functions) configured entirely through `VITE_*` env vars.

### Data flow (the big picture)

1. **Input** — `src/composables/useLeagueInput.ts` is the single entry point for adding a league (Sleeper username, Sleeper league ID, or ESPN league + optional private auth). It validates input, updates the URL query (`?leagueId=...&season=...&espn`), and dispatches to the right API loader.
2. **Fetch + transform** — `src/api/api.ts#getData` (Sleeper) and `src/api/espnApi.ts#getEspnLeagueInfo` (ESPN) fan out parallel requests, then assemble one big `LeagueInfoType` object holding rosters, weekly points, users, transactions, brackets, etc. ESPN data is normalized into the *same* `LeagueInfoType` shape as Sleeper so all downstream UI is platform-agnostic.
3. **Store** — the assembled `LeagueInfoType` is pushed into the Pinia store (`src/store/store.ts`, `useStore`). The store holds an **array** of leagues (`leagueInfo[]`) plus `currentLeagueId`; most getters index by `currentLeagueIndex`. Heavy/AI-derived data (playoff odds, draft grades, player rankings, weekly reports, manager profiles) is **lazily added** to the current league via dedicated `addXxx` actions, not fetched up front.
4. **Persistence** — `src/App.vue` watches the store and mirrors `leagueInfo`/`currentLeagueId` into `localStorage`. On load, `Home.vue#onMounted` rehydrates from `localStorage`, and **auto-refreshes any league older than 24h** by re-running `getData`/`getEspnLeagueInfo`. Always read/write localStorage through `src/lib/storage.ts#getParsedStorageItem` (validates shape, removes corrupt entries) rather than `JSON.parse(localStorage...)` directly.

### League identity / keys

A league is keyed by `getLeagueKey()` in `src/store/store.ts`: Sleeper uses the raw `leagueId`; ESPN uses `espn:${leagueId}:${season}` (because the same ESPN league ID is reused across seasons). When matching or deduping leagues, **always** use `getLeagueKey`, never the raw `leagueId`.

### UI / tab system

There is **one app route** (`/`) plus static pages (about, changelog, privacy, terms, account) defined in `src/main.ts`. The app is not router-driven for features — instead `store.currentTab` (a string like `"Power Rankings"`, `"Draft"`, `"Wrapped"`) drives which feature renders.

- `src/views/Home.vue` is the shell; it lazily mounts `src/components/standings/Table.vue`.
- `Table.vue` is the **central tab dispatcher**: it `defineAsyncComponent`-imports every feature component and shows them via `v-if="store.currentTab === '...'"`. To add a feature tab, register the lazy component and a `v-if` block here, and add the tab to the sidebar (`src/components/layout/AppSidebar.vue`).
- Components are organized by feature under `src/components/` (e.g. `power_rankings/`, `draft/`, `playoffs/`, `wrapped/`, `weekly_report/`, `trade_lab/`). `components/ui/` is shadcn-vue (reka-ui) primitives; `components/shared/` and `components/util/` are cross-feature helpers.
- Heavy feature components are `defineAsyncComponent` lazy-loaded to keep the initial bundle small (apexcharts is also split into its own vendor chunk in `vite.config.ts`).

### Backends & auth (self-hosted fork)

This fork is configured to run **standalone** — the AI/data backends that the
upstream project keeps private have been reimplemented as Vercel serverless
functions in `api/` (see `SETUP.md`). Key points:

- The `VITE_*` endpoint URLs are set to **relative `/api/...` paths** in the
  committed `.env.production` (and `.env.test`). They resolve to the functions in
  `api/`. `.env` itself is gitignored; secrets live in the Vercel dashboard.
- `api/` functions: AI features (`trends`, `league-recap`, `weekly-report`,
  `premium-report`, `weekly-report-audio`, `manager-profiles`, `weekly-preview`)
  call OpenAI via `api/_lib/openai.ts` (server-side `OPENAI_API_KEY`, no SDK —
  plain `fetch`). Player data (`players`, `player-id-lookup`) proxy/cache
  Sleeper's public player list via `api/_lib/sleeperPlayers.ts`. Logging
  (`log-league`, `log-username`, `account-alert`, `league-count`) is best-effort
  Supabase via `api/_lib/supabaseAdmin.ts`. `api/espn.ts` proxies ESPN.
- Shared helpers live in `api/_lib/` (the `_` prefix keeps Vercel from routing
  them). `requireUser` in `api/_lib/http.ts` gates premium endpoints behind a
  valid Supabase session (free login — there's no subscription check).
- `api/` is **not** covered by `npm run build` (tsconfig only includes `src/`).
  Type-check it separately, e.g. `npx tsc --noEmit --skipLibCheck --strict
  --target ES2020 --module ESNext --moduleResolution bundler --types node
  api/*.ts api/_lib/*.ts`. Vercel builds `api/` on deploy.
- **Paywall is removed.** `src/store/subscription.ts` honors `ALL_FEATURES_FREE`
  (`VITE_ALL_FEATURES_FREE`, default true): it always reports `isPremium` and
  never calls a billing backend. Set the var to `"false"` to restore the paywall.
- Authenticated calls go through `src/lib/authFetch.ts#authenticatedFetch`, which
  attaches the Supabase bearer token to same-origin/allow-listed requests. Use it
  instead of bare `fetch` for `/api` calls that need auth.
- Auth state: `src/store/auth.ts` (Supabase session). Both auth and subscription
  stores initialize in `src/main.ts` before mount.

### API layer map (`src/api/`)

- `api.ts` — shared/cross-platform fetchers, AI report generators, `getData` (Sleeper orchestrator), player news/lookups.
- `sleeperApi.ts` — raw Sleeper API calls (league, rosters, matchups, drafts, brackets, trade values).
- `espnApi.ts` — ESPN fetch + normalization into `LeagueInfoType`; ESPN auth helpers (`saveEspnAuth`, `getSavedEspnAuth`).
- `playerRanks.ts`, `draft.ts` — large analytics/ranking computations.
- `helper.ts` — shared transforms (draft rank, transactions, waiver moves) used by both platforms.
- `fakeLeague.ts` — fixture data shown on the landing page before a real league is loaded (`fakeUsers`/`fakeRosters`/`fakePoints`).

### Types

Shared types live in `src/types/types.ts` (app domain types, esp. `LeagueInfoType`) and `src/types/apiTypes.ts` (raw API/response shapes). `LeagueInfoType` is the central contract — adding a feature's data usually means extending it plus adding an `addXxx` store action.

## Conventions

- Path alias `@/` → `src/` (configured in both `vite.config.ts` and `tsconfig.json`). Existing code mixes `@/...` and relative imports.
- ESPN data must always be coerced into the same `LeagueInfoType` shape as Sleeper so feature components stay platform-agnostic — check both `getData` and `getEspnLeagueInfo` when changing the league shape.
- The app is a PWA (`vite-plugin-pwa`, autoUpdate). `src/main.ts` includes stale-chunk reload handling for dynamic-import failures after a deploy — be aware when touching async component loading.
