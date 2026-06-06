# Self-Hosting ffwrapped for Your League

This guide gets your own copy of ffwrapped deployed on Vercel, with accounts and
all the AI features unlocked **for free** to your league (you fund only the
OpenAI usage, which is a few dollars a season for one league).

This fork already includes everything that's normally hosted on a private
backend, rebuilt as serverless functions in [`api/`](api/):

| Feature | Endpoint | Needs |
| --- | --- | --- |
| Weekly report, premium report, league recap, trends, weekly preview, manager profiles, audio recap | `/api/ai?kind=...` | OpenAI key |
| Player data (start/sit, projections) | `/api/player?op=...` | nothing (uses public Sleeper data) |
| Accounts / login | — | Supabase project |
| League count + usage logging | `/api/log?type=...` | Supabase (optional) |

The Stripe paywall is removed — every premium feature is free. AI features sit
behind a **free sign-in** so random visitors with your URL can't run up your
OpenAI bill.

---

## What you need (all have free tiers except OpenAI usage)

1. A [GitHub](https://github.com) account (this repo pushed to it)
2. A [Vercel](https://vercel.com) account (free)
3. A [Supabase](https://supabase.com) account (free) — for login
4. An [OpenAI API key](https://platform.openai.com/api-keys) — pay-per-use

---

## Step 1 — Create a Supabase project (login/accounts)

1. Go to <https://supabase.com/dashboard> → **New project**. Pick a name and a
   strong database password (you won't need the password again for this app).
2. Once it finishes provisioning, open **Project Settings → API** and copy:
   - **Project URL** → this is `VITE_SUPABASE_URL` / `SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY`
   - **service_role** key (under "Project API keys", reveal it) →
     `SUPABASE_SERVICE_ROLE_KEY` *(secret — optional, for logging/league count)*
3. **Enable a login method:** **Authentication → Providers**.
   - Email is on by default. To skip email confirmation for friends, go to
     **Authentication → Sign In / Providers → Email** and turn **Confirm email**
     off (optional, friendlier for a private league).
   - To add "Sign in with Google", enable the Google provider and follow its
     prompts (optional).
4. *(Optional, enables the logging endpoints + landing-page league count.)* Open
   **SQL Editor** and run:

   ```sql
   create table if not exists leagues (
     league_id text primary key,
     name text, size int, type text, year text, platform text,
     created_at timestamptz default now()
   );
   create table if not exists usernames (
     id bigint generated always as identity primary key,
     username text, year text, created_at timestamptz default now()
   );
   create table if not exists account_alerts (
     id bigint generated always as identity primary key,
     email text, created_at timestamptz default now()
   );
   ```

   If you skip this, logging is silently disabled and the league count shows 0 —
   nothing else is affected.

---

## Step 2 — Get your OpenAI key

1. <https://platform.openai.com/api-keys> → **Create new secret key**, copy it
   (`sk-...`). This is `OPENAI_API_KEY`.
2. Add a little credit under **Billing**. The default model is `gpt-4o-mini`
   (cheap); you can change it with `OPENAI_MODEL`.

---

## Step 3 — Deploy to Vercel

1. Push this repo to your own GitHub.
2. <https://vercel.com/new> → **Import** the repo. Framework preset auto-detects
   **Vite**; leave the build command (`npm run build`) and output (`dist`) as-is.
3. Before the first deploy, expand **Environment Variables** and add:

   | Name | Value | Notes |
   | --- | --- | --- |
   | `OPENAI_API_KEY` | `sk-...` | required for AI features |
   | `VITE_SUPABASE_URL` | your Project URL | required for login |
   | `VITE_SUPABASE_ANON_KEY` | your anon key | required for login |
   | `SUPABASE_URL` | same Project URL | lets `/api` verify logins |
   | `SUPABASE_ANON_KEY` | same anon key | " |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key | optional (logging) |
   | `OPENAI_MODEL` | e.g. `gpt-4o-mini` | optional override |

   The `VITE_*` endpoint paths are already committed in
   [`.env.production`](.env.production) — you don't add those.
4. Click **Deploy**. You'll get a URL like `https://your-league.vercel.app`.
5. In Supabase → **Authentication → URL Configuration**, set the **Site URL** to
   your Vercel URL so login redirects work.

Share the URL with your league. They can use all the analytics immediately, and
sign in (free) to generate AI reports.

---

## Running locally

```bash
npm install
cp .env.example .env.local      # fill in OPENAI_API_KEY + Supabase values
npm run dev                     # http://localhost:5173
```

> Note: `npm run dev` serves only the frontend. To exercise the `/api` functions
> locally, use `npx vercel dev` instead (after `npm i -g vercel` and `vercel login`).

---

## Optional polish

- **Custom domain:** add it in Vercel → Settings → Domains. Then update the
  hardcoded `siteUrl` in [`src/main.ts`](src/main.ts) and the canonical/og URLs
  in [`index.html`](index.html) for correct SEO (cosmetic).
- **Player news:** `/api/player?op=news` returns empty by default (no free news
  source). Plug a provider into the `news` branch of [`api/player.ts`](api/player.ts)
  to enable the Start/Sit news blurbs.
- **Re-enable a paywall:** set `VITE_ALL_FEATURES_FREE=false` and stand up a
  billing backend (out of scope here).
