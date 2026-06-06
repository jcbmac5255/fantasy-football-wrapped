import {
  ApiRequest,
  ApiResponse,
  rejectWrongMethod,
  sendJson,
} from "./_lib/http";
import { getPlayersCache, lookupPlayerId } from "./_lib/sleeperPlayers";

// Player data, selected via ?op=. Consolidated into one function for the Hobby
// plan limit.
//   /api/player?op=byIds&ids=a,b        -> { players: SleeperPlayer[] }
//   /api/player?op=lookup&name=&team=   -> { players: [{ name, team, player_id }] }
//   /api/player?op=news&keywords=a,b    -> NewsItem[] (empty; see note below)
const toArray = (value: string | string[] | undefined): string[] => {
  if (Array.isArray(value)) return value;
  if (value === undefined) return [];
  return [value];
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (rejectWrongMethod(req, res, "GET")) return;

  const opParam = req.query?.op;
  const op = Array.isArray(opParam) ? opParam[0] : opParam;

  // Player news: the original instance used a paid NFL news provider. There's no
  // free drop-in source, so this returns an empty list (the Start/Sit UI handles
  // "no news" gracefully). Plug a provider in here to enable it. See SETUP.md.
  if (op === "news") {
    res.setHeader("Cache-Control", "public, max-age=600");
    return sendJson(res, 200, []);
  }

  try {
    if (op === "lookup") {
      const names = toArray(req.query?.name);
      const teams = toArray(req.query?.team);
      if (names.length === 0) return sendJson(res, 200, { players: [] });

      const cacheData = await getPlayersCache();
      const players = names.map((name, index) => {
        const team = teams[index] ?? "";
        return { name, team, player_id: lookupPlayerId(cacheData, name, team) };
      });
      res.setHeader("Cache-Control", "public, max-age=3600");
      return sendJson(res, 200, { players });
    }

    // Default op: byIds
    const rawIds = req.query?.ids;
    const idsParam = Array.isArray(rawIds) ? rawIds.join(",") : (rawIds ?? "");
    const ids = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length === 0) return sendJson(res, 200, { players: [] });

    const { byId } = await getPlayersCache();
    const players = ids
      .map((id) => byId[id])
      .filter((player): player is NonNullable<typeof player> => Boolean(player));
    res.setHeader("Cache-Control", "public, max-age=3600");
    return sendJson(res, 200, { players });
  } catch (error) {
    console.error(`player (${op}) error:`, error);
    return sendJson(res, 200, op === "lookup" ? { players: [] } : { players: [] });
  }
}
