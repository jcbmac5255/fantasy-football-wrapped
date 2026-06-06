import {
  ApiRequest,
  ApiResponse,
  rejectWrongMethod,
  sendJson,
} from "./_lib/http";
import { chat } from "./_lib/openai";

// POST { data } -> { text: string (markdown) }
// Generates a look-ahead preview of the upcoming week's matchups.
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (rejectWrongMethod(req, res, "POST")) return;

  const body = (req.body ?? {}) as { data?: unknown };

  try {
    const text = await chat(
      [
        {
          role: "system",
          content:
            "You are a fantasy football analyst previewing the upcoming week. For each " +
            "matchup, set the stakes, pick a favorite, flag the must-watch game and any " +
            "potential upsets. Use markdown with short, energetic paragraphs. Name real teams.",
        },
        {
          role: "user",
          content:
            "Upcoming matchups and context:\n" +
            JSON.stringify(body.data ?? {}).slice(0, 14000),
        },
      ],
      { maxTokens: 1000 }
    );
    sendJson(res, 200, { text });
  } catch (error) {
    console.error("weekly-preview error:", error);
    sendJson(res, 200, {
      text: "Unable to generate preview. Please try again later.",
    });
  }
}
