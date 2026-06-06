import {
  ApiRequest,
  ApiResponse,
  rejectWrongMethod,
  sendJson,
} from "./_lib/http";
import { insertRow } from "./_lib/supabaseAdmin";

// POST { data: { league_id, name, size, type, year, platform } }
// Best-effort logging of submitted leagues (powers the landing-page count).
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (rejectWrongMethod(req, res, "POST")) return;

  const data = ((req.body ?? {}) as { data?: Record<string, unknown> }).data;
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
  sendJson(res, 200, { ok: true });
}
