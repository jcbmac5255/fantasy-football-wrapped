import {
  ApiRequest,
  ApiResponse,
  rejectWrongMethod,
  sendJson,
} from "./_lib/http";
import { chat, parseJsonResponse } from "./_lib/openai";

// POST { data, wordLimit, bulletCount, leagueState } -> { bulletPoints: string[] }
// Generates short "current trends" bullet points about the league.
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (rejectWrongMethod(req, res, "POST")) return;

  const body = (req.body ?? {}) as {
    data?: unknown;
    wordLimit?: number;
    bulletCount?: number;
    leagueState?: string;
  };
  const wordLimit = Number(body.wordLimit) || 55;
  const bulletCount = Number(body.bulletCount) || 3;
  const leagueState = body.leagueState ?? "in_season";

  try {
    const raw = await chat(
      [
        {
          role: "system",
          content:
            "You are a witty fantasy football analyst. Given league data, write punchy, " +
            "specific bullet points about notable trends, hot/cold teams, standout players, " +
            "and trade/waiver activity. Reference real team and player names from the data. " +
            "Respond ONLY with a JSON object of the form " +
            '{"bulletPoints": ["...", "..."]}.',
        },
        {
          role: "user",
          content:
            `League state: ${leagueState}\n` +
            `Write exactly ${bulletCount} bullet points, each under ${wordLimit} words. ` +
            `Use markdown for emphasis where helpful.\n\nData:\n` +
            JSON.stringify(body.data ?? []).slice(0, 12000),
        },
      ],
      { json: true, maxTokens: 600 }
    );

    const parsed = parseJsonResponse<{ bulletPoints?: unknown }>(raw);
    const bulletPoints = Array.isArray(parsed.bulletPoints)
      ? parsed.bulletPoints.map((b) => String(b)).slice(0, bulletCount)
      : [];
    sendJson(res, 200, { bulletPoints });
  } catch (error) {
    console.error("trends error:", error);
    sendJson(res, 200, { bulletPoints: [] });
  }
}
