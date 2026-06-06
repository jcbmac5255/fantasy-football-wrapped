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
