import {
  ApiRequest,
  ApiResponse,
  rejectWrongMethod,
  requireUser,
  sendJson,
} from "./_lib/http";
import { chat, parseJsonResponse } from "./_lib/openai";

// POST { data: ManagerBlurbsPayload } -> { blurbs: [{ userId, name, blurb }] }
// Writes a short "manager archetype" blurb for each manager. Requires sign-in.
type Manager = { userId: string; name: string; [key: string]: unknown };

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (rejectWrongMethod(req, res, "POST")) return;
  if (!(await requireUser(req, res))) return;

  const body = (req.body ?? {}) as {
    data?: { league?: unknown; managers?: Manager[] };
  };
  const managers = Array.isArray(body.data?.managers)
    ? body.data!.managers
    : [];

  if (managers.length === 0) {
    sendJson(res, 200, { blurbs: [] });
    return;
  }

  try {
    const raw = await chat(
      [
        {
          role: "system",
          content:
            "You are a fantasy football analyst assigning each manager a fun 'archetype' " +
            "(e.g. The Tinkerer, The Drafting Savant, The Trade Shark) based on their stats " +
            "and relative ranks. For each manager write a 2-3 sentence blurb capturing their " +
            "identity, strengths and weaknesses. Respond ONLY with JSON of the form " +
            '{"blurbs": [{"userId": "...", "name": "...", "blurb": "..."}]}, one per manager.',
        },
        {
          role: "user",
          content:
            "League:\n" +
            JSON.stringify(body.data?.league ?? {}).slice(0, 2000) +
            "\n\nManagers:\n" +
            JSON.stringify(managers).slice(0, 16000),
        },
      ],
      { json: true, maxTokens: 1600 }
    );

    const parsed = parseJsonResponse<{ blurbs?: unknown }>(raw);
    const byUser = new Map<string, string>();
    if (Array.isArray(parsed.blurbs)) {
      parsed.blurbs.forEach((b) => {
        const entry = b as { userId?: string; blurb?: string };
        if (entry.userId && entry.blurb) {
          byUser.set(String(entry.userId), String(entry.blurb));
        }
      });
    }

    // Guarantee one entry per requested manager, in order.
    const blurbs = managers.map((m) => ({
      userId: m.userId,
      name: m.name,
      blurb: byUser.get(m.userId) ?? "",
    }));
    sendJson(res, 200, { blurbs });
  } catch (error) {
    console.error("manager-profiles error:", error);
    sendJson(res, 500, {
      error: "Unable to generate manager profiles right now. Please try again later.",
    });
  }
}
