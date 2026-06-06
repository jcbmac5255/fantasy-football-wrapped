// Tiny Supabase admin helper using PostgREST + the service-role key. Every call
// is best-effort: if Supabase isn't configured (or the table is missing) it
// resolves without throwing, so the optional analytics endpoints never break.

const getConfig = () => {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
};

export const isAdminConfigured = (): boolean => getConfig() !== null;

export const insertRow = async (
  table: string,
  row: Record<string, unknown>
): Promise<void> => {
  const config = getConfig();
  if (!config) return;
  try {
    await fetch(`${config.url}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(row),
    });
  } catch (error) {
    console.error(`insertRow(${table}) failed:`, error);
  }
};

// Delete rows matching a PostgREST filter, e.g. "user_id=eq.123".
export const deleteRows = async (
  table: string,
  query: string
): Promise<void> => {
  const config = getConfig();
  if (!config || !query) return;
  try {
    await fetch(`${config.url}/rest/v1/${table}?${query}`, {
      method: "DELETE",
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
      },
    });
  } catch (error) {
    console.error(`deleteRows(${table}) failed:`, error);
  }
};

// Generic PostgREST select. `query` is a raw querystring, e.g.
// "user_id=eq.123&select=roster_id,active". Returns [] when unconfigured.
export const selectRows = async <T>(
  table: string,
  query = ""
): Promise<T[]> => {
  const config = getConfig();
  if (!config) return [];
  try {
    const url = `${config.url}/rest/v1/${table}${query ? `?${query}` : ""}`;
    const response = await fetch(url, {
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
      },
    });
    if (!response.ok) return [];
    return (await response.json()) as T[];
  } catch (error) {
    console.error(`selectRows(${table}) failed:`, error);
    return [];
  }
};

export const countRows = async (table: string): Promise<number> => {
  const config = getConfig();
  if (!config) return 0;
  try {
    const response = await fetch(
      `${config.url}/rest/v1/${table}?select=*`,
      {
        method: "HEAD",
        headers: {
          apikey: config.serviceKey,
          Authorization: `Bearer ${config.serviceKey}`,
          Prefer: "count=exact",
          Range: "0-0",
        },
      }
    );
    // PostgREST returns the total in the Content-Range header: "0-0/1234"
    const range = response.headers.get("content-range");
    const total = range?.split("/")[1];
    return total ? Number(total) : 0;
  } catch (error) {
    console.error(`countRows(${table}) failed:`, error);
    return 0;
  }
};

// Shared weekly-report cache (one canonical report per league/season/week).
// Returns null when not configured or not yet generated.
export const getStoredReport = async (
  leagueId: string,
  season: string,
  week: number
): Promise<string | null> => {
  const config = getConfig();
  if (!config) return null;
  try {
    const query =
      `league_id=eq.${encodeURIComponent(leagueId)}` +
      `&season=eq.${encodeURIComponent(season)}` +
      `&week=eq.${week}&select=report&limit=1`;
    const response = await fetch(
      `${config.url}/rest/v1/weekly_reports?${query}`,
      {
        headers: {
          apikey: config.serviceKey,
          Authorization: `Bearer ${config.serviceKey}`,
        },
      }
    );
    if (!response.ok) return null;
    const rows = (await response.json()) as { report?: string }[];
    return rows?.[0]?.report ?? null;
  } catch (error) {
    console.error("getStoredReport failed:", error);
    return null;
  }
};

export const saveStoredReport = async (
  leagueId: string,
  season: string,
  week: number,
  report: string
): Promise<void> => {
  // PK (league_id, season, week) + merge-duplicates makes this an upsert.
  await insertRow("weekly_reports", {
    league_id: leagueId,
    season,
    week,
    report,
  });
};

// Shared manager-profiles cache (one set of blurbs per league/season). Stored in
// app_settings (no dedicated table needed) as a JSON string.
const profilesKey = (leagueId: string, season: string) =>
  `manager_profiles:${leagueId}:${season}`;

export const getStoredProfiles = async <T>(
  leagueId: string,
  season: string
): Promise<T | null> => {
  const rows = await selectRows<{ value: string }>(
    "app_settings",
    `key=eq.${encodeURIComponent(profilesKey(leagueId, season))}&select=value&limit=1`
  );
  if (!rows[0]?.value) return null;
  try {
    return JSON.parse(rows[0].value) as T;
  } catch {
    return null;
  }
};

export const saveStoredProfiles = async (
  leagueId: string,
  season: string,
  blurbs: unknown
): Promise<void> => {
  await insertRow("app_settings", {
    key: profilesKey(leagueId, season),
    value: JSON.stringify(blurbs),
  });
};
