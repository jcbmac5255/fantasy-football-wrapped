import {
  ApiRequest,
  ApiResponse,
  rejectWrongMethod,
  sendJson,
} from "./_lib/http";
import { insertRow } from "./_lib/supabaseAdmin";

// POST { data: { email } } -- best-effort logging of new signups.
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (rejectWrongMethod(req, res, "POST")) return;

  const data = ((req.body ?? {}) as { data?: Record<string, unknown> }).data;
  if (data?.email) {
    await insertRow("account_alerts", { email: String(data.email) });
  }
  sendJson(res, 200, { ok: true });
}
