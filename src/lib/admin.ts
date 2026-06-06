import { authenticatedFetch } from "./authFetch";

// Client helpers for the admin + membership API (api/admin.ts).
const ADMIN_URL = "/api/admin";

export type LeagueMember = {
  user_id: string;
  email: string | null;
  roster_id: number | null;
  active: boolean | null;
};

// Public: the live Sleeper league id (admin-editable, falls back to config).
export const getSettings = async (): Promise<{ leagueId: string | null }> => {
  try {
    const response = await fetch(`${ADMIN_URL}?action=getSettings`);
    if (!response.ok) return { leagueId: null };
    return (await response.json()) as { leagueId: string | null };
  } catch {
    return { leagueId: null };
  }
};

// Record the signed-in user as a league member (id + email). Safe to call on
// every login — it never resets an existing member's team or active flag.
export const registerMember = async (): Promise<void> => {
  try {
    await authenticatedFetch(`${ADMIN_URL}?action=register`, { method: "POST" });
  } catch {
    // best-effort
  }
};

// The signed-in user's assigned team + active status.
export const getMyTeam = async (): Promise<{
  rosterId: number | null;
  active: boolean | null;
}> => {
  try {
    const response = await authenticatedFetch(`${ADMIN_URL}?action=getMe`);
    if (!response.ok) return { rosterId: null, active: null };
    return (await response.json()) as {
      rosterId: number | null;
      active: boolean | null;
    };
  } catch {
    return { rosterId: null, active: null };
  }
};

// ---- admin-only ----
export const listMembers = async (): Promise<LeagueMember[]> => {
  const response = await authenticatedFetch(`${ADMIN_URL}?action=listMembers`);
  if (!response.ok) throw new Error("Failed to load members.");
  const data = (await response.json()) as { members?: LeagueMember[] };
  return data.members ?? [];
};

export const setLeagueId = async (leagueId: string): Promise<void> => {
  const response = await authenticatedFetch(`${ADMIN_URL}?action=setLeagueId`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leagueId }),
  });
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Failed to update league id.");
  }
};

export const setMember = async (
  userId: string,
  rosterId: number | null,
  active: boolean
): Promise<void> => {
  const response = await authenticatedFetch(`${ADMIN_URL}?action=setMember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, rosterId, active }),
  });
  if (!response.ok) throw new Error("Failed to update member.");
};
