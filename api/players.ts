import {
  ApiRequest,
  ApiResponse,
  rejectWrongMethod,
  sendJson,
} from "./_lib/http";
import { getPlayersCache } from "./_lib/sleeperPlayers";

// GET /api/players?ids=123,456 -> { players: SleeperPlayer[] }
// Resolves Sleeper player ids to full player objects.
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (rejectWrongMethod(req, res, "GET")) return;

  const rawIds = req.query?.ids;
  const idsParam = Array.isArray(rawIds) ? rawIds.join(",") : (rawIds ?? "");
  const ids = idsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    sendJson(res, 200, { players: [] });
    return;
  }

  try {
    const { byId } = await getPlayersCache();
    const players = ids
      .map((id) => byId[id])
      .filter((player): player is NonNullable<typeof player> => Boolean(player));
    res.setHeader("Cache-Control", "public, max-age=3600");
    sendJson(res, 200, { players });
  } catch (error) {
    console.error("players error:", error);
    sendJson(res, 200, { players: [] });
  }
}
