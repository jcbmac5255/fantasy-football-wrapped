// Fetches and caches Sleeper's public NFL player list, used by the player data
// endpoints. The full list is ~5MB, so we cache it in lambda memory with a TTL.

const PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export type SleeperPlayer = {
  player_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  team?: string | null;
  position?: string | null;
  [key: string]: unknown;
};

type Cache = {
  byId: Record<string, SleeperPlayer>;
  byNameTeam: Map<string, string>; // "name::TEAM" -> player_id
  fetchedAt: number;
};

let cache: Cache | null = null;
let inflight: Promise<Cache> | null = null;

const nameTeamKey = (name: string, team: string): string =>
  `${name.trim().toLowerCase()}::${(team ?? "").trim().toUpperCase()}`;

const buildCache = async (): Promise<Cache> => {
  const response = await fetch(PLAYERS_URL);
  if (!response.ok) {
    throw new Error(`Sleeper players request failed (${response.status})`);
  }
  const byId = (await response.json()) as Record<string, SleeperPlayer>;

  const byNameTeam = new Map<string, string>();
  for (const [id, player] of Object.entries(byId)) {
    if (!player) continue;
    const name =
      player.full_name ??
      [player.first_name, player.last_name].filter(Boolean).join(" ");
    if (!name) continue;
    // Index with and without team so lookups still match when team is unknown.
    byNameTeam.set(nameTeamKey(name, player.team ?? ""), id);
    if (player.team) byNameTeam.set(nameTeamKey(name, ""), id);
  }

  return { byId, byNameTeam, fetchedAt: Date.now() };
};

export const getPlayersCache = async (): Promise<Cache> => {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return cache;
  }
  if (!inflight) {
    inflight = buildCache()
      .then((built) => {
        cache = built;
        return built;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
};

export const lookupPlayerId = (
  cacheData: Cache,
  name: string,
  team: string
): string | null => {
  return (
    cacheData.byNameTeam.get(nameTeamKey(name, team)) ??
    cacheData.byNameTeam.get(nameTeamKey(name, "")) ??
    null
  );
};
