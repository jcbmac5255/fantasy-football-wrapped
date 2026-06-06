import {
  ApiRequest,
  ApiResponse,
  rejectWrongMethod,
  sendJson,
} from "./_lib/http";
import { getPlayersCache, lookupPlayerId } from "./_lib/sleeperPlayers";

// GET /api/player-id-lookup?name=A&team=X&name=B&team=Y
//   -> { players: [{ name, team, player_id }] } (in request order)
// Resolves player name + team pairs to Sleeper player ids.
const toArray = (value: string | string[] | undefined): string[] => {
  if (Array.isArray(value)) return value;
  if (value === undefined) return [];
  return [value];
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (rejectWrongMethod(req, res, "GET")) return;

  const names = toArray(req.query?.name);
  const teams = toArray(req.query?.team);

  if (names.length === 0) {
    sendJson(res, 200, { players: [] });
    return;
  }

  try {
    const cacheData = await getPlayersCache();
    const players = names.map((name, index) => {
      const team = teams[index] ?? "";
      return { name, team, player_id: lookupPlayerId(cacheData, name, team) };
    });
    res.setHeader("Cache-Control", "public, max-age=3600");
    sendJson(res, 200, { players });
  } catch (error) {
    console.error("player-id-lookup error:", error);
    sendJson(res, 200, {
      players: names.map((name, index) => ({
        name,
        team: teams[index] ?? "",
        player_id: null,
      })),
    });
  }
}
