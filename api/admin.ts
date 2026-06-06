import {
  ApiRequest,
  ApiResponse,
  getAuthenticatedUser,
  rejectWrongMethod,
  requireAdmin,
  sendJson,
} from "./_lib/http.js";
import {
  deleteRows,
  insertRow,
  selectRows,
  updateRows,
} from "./_lib/supabaseAdmin.js";

// Admin + membership API, selected via ?action=.
//   GET  ?action=getSettings                      (public)  -> { leagueId }
//   GET  ?action=getMe                            (signed-in) -> { rosterId, active }
//   GET  ?action=listMembers                      (admin)   -> { members: [...] }
//   POST ?action=register                         (signed-in) upsert self
//   POST ?action=setLeagueId   { leagueId }       (admin)
//   POST ?action=setMember     { userId, rosterId, active }  (admin)
type MemberRow = {
  user_id: string;
  email: string | null;
  roster_id: number | null;
  active: boolean | null;
  last_login: string | null;
  last_seen: string | null;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const actionParam = req.query?.action;
  const action = Array.isArray(actionParam) ? actionParam[0] : actionParam;
  const method = (req.method ?? "GET").toUpperCase();

  // ---- public ----
  if (action === "getSettings") {
    if (rejectWrongMethod(req, res, "GET")) return;
    const rows = await selectRows<{ value: string }>(
      "app_settings",
      "key=eq.league_id&select=value&limit=1"
    );
    return sendJson(res, 200, { leagueId: rows[0]?.value ?? null });
  }

  // ---- signed-in (any league member) ----
  if (action === "register") {
    if (rejectWrongMethod(req, res, "POST")) return;
    const user = await getAuthenticatedUser(req);
    if (!user) return sendJson(res, 401, { error: "Please sign in." });
    const existing = await selectRows<MemberRow>(
      "league_members",
      `user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`
    );
    const now = new Date().toISOString();
    if (existing.length > 0) {
      // Existing member: refresh email + login time; preserve team + active.
      await insertRow("league_members", {
        user_id: user.id,
        email: user.email,
        last_login: now,
        last_seen: now,
      });
    } else {
      // New member: start inactive until the admin activates + assigns a team.
      await insertRow("league_members", {
        user_id: user.id,
        email: user.email,
        active: false,
        last_login: now,
        last_seen: now,
      });
    }
    return sendJson(res, 200, { ok: true });
  }

  if (action === "heartbeat") {
    if (rejectWrongMethod(req, res, "POST")) return;
    const user = await getAuthenticatedUser(req);
    if (!user) return sendJson(res, 401, { error: "Please sign in." });
    await updateRows(
      "league_members",
      `user_id=eq.${encodeURIComponent(user.id)}`,
      { last_seen: new Date().toISOString() }
    );
    return sendJson(res, 200, { ok: true });
  }

  if (action === "activeRosters") {
    if (rejectWrongMethod(req, res, "GET")) return;
    const user = await getAuthenticatedUser(req);
    if (!user) return sendJson(res, 401, { error: "Please sign in." });
    const rows = await selectRows<MemberRow>(
      "league_members",
      "active=eq.true&roster_id=not.is.null&select=roster_id"
    );
    const rosterIds = rows
      .map((r) => r.roster_id)
      .filter((id): id is number => id !== null);
    return sendJson(res, 200, { rosterIds });
  }

  if (action === "getMe") {
    if (rejectWrongMethod(req, res, "GET")) return;
    const user = await getAuthenticatedUser(req);
    if (!user) return sendJson(res, 401, { error: "Please sign in." });
    const rows = await selectRows<MemberRow>(
      "league_members",
      `user_id=eq.${encodeURIComponent(user.id)}&select=roster_id,active&limit=1`
    );
    return sendJson(res, 200, {
      rosterId: rows[0]?.roster_id ?? null,
      active: rows[0]?.active ?? null,
    });
  }

  // ---- admin only ----
  if (action === "listMembers") {
    if (rejectWrongMethod(req, res, "GET")) return;
    if (!(await requireAdmin(req, res))) return;
    const members = await selectRows<MemberRow>(
      "league_members",
      "select=user_id,email,roster_id,active,last_login,last_seen&order=email.asc"
    );
    return sendJson(res, 200, { members });
  }

  if (action === "setLeagueId") {
    if (rejectWrongMethod(req, res, "POST")) return;
    if (!(await requireAdmin(req, res))) return;
    const leagueId = String(
      ((req.body ?? {}) as { leagueId?: unknown }).leagueId ?? ""
    ).trim();
    if (!/^\d+$/.test(leagueId)) {
      return sendJson(res, 400, { error: "Invalid Sleeper league id." });
    }
    await insertRow("app_settings", { key: "league_id", value: leagueId });
    return sendJson(res, 200, { ok: true, leagueId });
  }

  if (action === "setMember") {
    if (rejectWrongMethod(req, res, "POST")) return;
    if (!(await requireAdmin(req, res))) return;
    const body = (req.body ?? {}) as {
      userId?: string;
      rosterId?: number | null;
      active?: boolean;
    };
    if (!body.userId) {
      return sendJson(res, 400, { error: "Missing userId." });
    }
    await insertRow("league_members", {
      user_id: body.userId,
      roster_id:
        body.rosterId === undefined || body.rosterId === null
          ? null
          : Number(body.rosterId),
      active: body.active ?? true,
    });
    return sendJson(res, 200, { ok: true });
  }

  if (action === "deleteMember") {
    if (rejectWrongMethod(req, res, "POST")) return;
    if (!(await requireAdmin(req, res))) return;
    const userId = ((req.body ?? {}) as { userId?: string }).userId;
    if (!userId) return sendJson(res, 400, { error: "Missing userId." });
    await deleteRows(
      "league_members",
      `user_id=eq.${encodeURIComponent(userId)}`
    );
    return sendJson(res, 200, { ok: true });
  }

  void method;
  return sendJson(res, 400, { error: `Unknown action: ${action ?? ""}` });
}
