import {
  ApiRequest,
  ApiResponse,
  getHeader,
  rejectWrongMethod,
  requireUser,
  sendJson,
} from "./_lib/http.js";
import {
  runAudio,
  runLeagueRecap,
  runManagerProfiles,
  runPremiumReport,
  runTrends,
  runWeeklyPreview,
  runWeeklyReport,
} from "./_lib/ai.js";
import {
  getStoredProfiles,
  getStoredReport,
  saveStoredProfiles,
  saveStoredReport,
} from "./_lib/supabaseAdmin.js";

type ManagerBlurb = { userId: string; name: string; blurb: string };

// Shared manager profiles: one set per league/season, generated once and reused
// by everyone (like the weekly report).
const handleSharedManagerProfiles = async (body: Record<string, unknown>) => {
  const data = body.data as { league?: { leagueId?: string } } | undefined;
  const leagueId = data?.league?.leagueId ?? "";
  const season = typeof body.season === "string" ? body.season : "";
  const force = body.force === true;
  const canCache = Boolean(leagueId && season);

  if (canCache && !force) {
    const cached = await getStoredProfiles<ManagerBlurb[]>(leagueId, season);
    if (cached && cached.length) return { blurbs: cached };
  }

  const result = await runManagerProfiles(body);
  if (canCache && result.blurbs.length) {
    await saveStoredProfiles(leagueId, season, result.blurbs);
  }
  return result;
};

// Shared weekly report: return the one canonical copy if it exists, otherwise
// generate it once and store it so the whole league sees the same report.
const FALLBACK_PREFIX = "Unable to generate";
const handleSharedWeeklyReport = async (body: Record<string, unknown>) => {
  const leagueId = typeof body.leagueId === "string" ? body.leagueId : "";
  const season = typeof body.season === "string" ? body.season : "";
  const week = Number(body.currentWeek);
  const canCache = Boolean(leagueId && season && week);

  if (canCache) {
    const cached = await getStoredReport(leagueId, season, week);
    if (cached) return { text: cached };
  }

  const result = await runWeeklyReport(body);
  if (canCache && result.text && !result.text.startsWith(FALLBACK_PREFIX)) {
    await saveStoredReport(leagueId, season, week, result.text);
  }
  return result;
};

// Single entrypoint for every AI feature, selected via ?kind=.
// Consolidated into one function to stay within Vercel's Hobby plan limit.
//   /api/ai?kind=trends|league-recap|weekly-report|weekly-preview   (open)
//   /api/ai?kind=premium-report|manager-profiles|audio              (sign-in)
const KINDS_REQUIRING_AUTH = new Set([
  "premium-report",
  "manager-profiles",
  "audio",
]);

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (rejectWrongMethod(req, res, "POST")) return;

  const kindParam = req.query?.kind;
  const kind = Array.isArray(kindParam) ? kindParam[0] : kindParam;
  const body = (req.body ?? {}) as Record<string, unknown>;

  if (kind && KINDS_REQUIRING_AUTH.has(kind)) {
    if (!(await requireUser(req, res))) return;
  }

  try {
    switch (kind) {
      case "trends":
        return sendJson(res, 200, await runTrends(body));
      case "league-recap":
        return sendJson(res, 200, await runLeagueRecap(body));
      case "weekly-report":
        return sendJson(res, 200, await handleSharedWeeklyReport(body));
      case "weekly-preview":
        return sendJson(res, 200, await runWeeklyPreview(body));
      case "premium-report":
        return sendJson(res, 200, await runPremiumReport(body));
      case "manager-profiles":
        return sendJson(res, 200, await handleSharedManagerProfiles(body));
      case "audio": {
        const audio = await runAudio(body as { text?: string });
        res.statusCode = 200;
        res.setHeader("Content-Type", "audio/mpeg");
        // Hint to the browser; harmless if ignored.
        void getHeader(req, "accept");
        return res.end(audio);
      }
      default:
        return sendJson(res, 400, { error: `Unknown AI kind: ${kind ?? ""}` });
    }
  } catch (error) {
    console.error(`ai (${kind}) error:`, error);
    // manager-profiles/audio throw on failure; others return fallbacks above.
    return sendJson(res, 500, {
      error: "Unable to generate this right now. Please try again later.",
    });
  }
}
