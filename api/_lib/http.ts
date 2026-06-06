// Shared helpers for the Vercel serverless functions under /api.
// Files prefixed with "_" are not treated as routes by Vercel.

export type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
};

export type ApiResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string | Buffer) => void;
};

export const sendJson = (
  res: ApiResponse,
  status: number,
  payload: unknown
) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

// Reject anything that isn't the expected method. Returns true when handled.
export const rejectWrongMethod = (
  req: ApiRequest,
  res: ApiResponse,
  method: "GET" | "POST"
): boolean => {
  if ((req.method ?? "GET").toUpperCase() !== method) {
    res.setHeader("Allow", method);
    sendJson(res, 405, { error: "Method not allowed" });
    return true;
  }
  return false;
};

export const getHeader = (
  req: ApiRequest,
  name: string
): string | undefined => {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

export type AuthUser = { id: string; email: string | null };

// Verify the caller's Supabase session by exchanging the bearer token for a
// user. Returns { id, email }, or null if the token is missing/invalid.
export const getAuthenticatedUser = async (
  req: ApiRequest
): Promise<AuthUser | null> => {
  const authHeader = getHeader(req, "authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : undefined;
  if (!token) return null;

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    });
    if (!response.ok) return null;
    const user = (await response.json()) as { id?: string; email?: string };
    if (!user.id) return null;
    return { id: user.id, email: user.email ?? null };
  } catch {
    return null;
  }
};

export const getAuthenticatedUserId = async (
  req: ApiRequest
): Promise<string | null> => {
  const user = await getAuthenticatedUser(req);
  return user?.id ?? null;
};

const ADMIN_EMAIL = (
  process.env.ADMIN_EMAIL ?? "jcbmac5255@gmail.com"
).toLowerCase();

// Require the caller to be the admin account. Returns the admin
// user, or sends 401/403 and returns null.
export const requireAdmin = async (
  req: ApiRequest,
  res: ApiResponse
): Promise<AuthUser | null> => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    sendJson(res, 401, { error: "Please sign in." });
    return null;
  }
  if ((user.email ?? "").toLowerCase() !== ADMIN_EMAIL) {
    sendJson(res, 403, { error: "Admin access required." });
    return null;
  }
  return user;
};

// Require a logged-in user for premium endpoints. When the instance is running
// with all features free we only need a valid session (no subscription check).
// Returns the user id, or sends a 401 and returns null.
export const requireUser = async (
  req: ApiRequest,
  res: ApiResponse
): Promise<string | null> => {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    sendJson(res, 401, { error: "Please sign in to use this feature." });
    return null;
  }
  return userId;
};
