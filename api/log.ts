import {
  ApiRequest,
  ApiResponse,
  sendJson,
} from "./_lib/http.js";
import { countRows, insertRow } from "./_lib/supabaseAdmin.js";

// Best-effort analytics + the landing-page league count, selected via ?type=.
// Consolidated into one function for the Hobby plan limit. All writes are
// fire-and-forget and silently no-op when Supabase isn't configured.
//   POST /api/log?type=league    { data: { league_id, name, size, type, year, platform } }
//   POST /api/log?type=username  { data: { username, year } }
//   POST /api/log?type=alert     { data: { email } }
//   GET  /api/log?type=count                          -> { league_id_count }
export default async function handler(req: ApiRequest, res: ApiResponse) {
  const typeParam = req.query?.type;
  const type = Array.isArray(typeParam) ? typeParam[0] : typeParam;

  if (type === "count") {
    if ((req.method ?? "GET").toUpperCase() !== "GET") {
      res.setHeader("Allow", "GET");
      return sendJson(res, 405, { error: "Method not allowed" });
    }
    const league_id_count = await countRows("leagues");
    res.setHeader("Cache-Control", "public, max-age=300");
    return sendJson(res, 200, { league_id_count });
  }

  if ((req.method ?? "GET").toUpperCase() !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const data = ((req.body ?? {}) as { data?: Record<string, unknown> }).data;

  switch (type) {
    case "league":
      if (data?.league_id) {
        await insertRow("leagues", {
          league_id: String(data.league_id),
          name: data.name ?? null,
          size: data.size ?? null,
          type: data.type ?? null,
          year: data.year ?? null,
          platform: data.platform ?? "sleeper",
        });
      }
      break;
    case "username":
      if (data?.username) {
        await insertRow("usernames", {
          username: String(data.username),
          year: data.year ?? null,
        });
      }
      break;
    case "alert":
      if (data?.email) {
        await insertRow("account_alerts", { email: String(data.email) });
      }
      break;
    default:
      return sendJson(res, 400, { error: `Unknown log type: ${type ?? ""}` });
  }

  return sendJson(res, 200, { ok: true });
}
