import {
  ApiRequest,
  ApiResponse,
  rejectWrongMethod,
  sendJson,
} from "./_lib/http";
import { countRows } from "./_lib/supabaseAdmin";

// GET -> { league_id_count: number }. Landing-page vanity stat.
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (rejectWrongMethod(req, res, "GET")) return;
  const league_id_count = await countRows("leagues");
  res.setHeader("Cache-Control", "public, max-age=300");
  sendJson(res, 200, { league_id_count });
}
