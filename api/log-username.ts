import {
  ApiRequest,
  ApiResponse,
  rejectWrongMethod,
  sendJson,
} from "./_lib/http";
import { insertRow } from "./_lib/supabaseAdmin";

// POST { data: { username, year } } -- best-effort usage logging.
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (rejectWrongMethod(req, res, "POST")) return;

  const data = ((req.body ?? {}) as { data?: Record<string, unknown> }).data;
  if (data?.username) {
    await insertRow("usernames", {
      username: String(data.username),
      year: data.year ?? null,
    });
  }
  sendJson(res, 200, { ok: true });
}
