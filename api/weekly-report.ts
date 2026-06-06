import {
  ApiRequest,
  ApiResponse,
  rejectWrongMethod,
  sendJson,
} from "./_lib/http";
import { chat } from "./_lib/openai";

// POST { data: { leagueMetadata, matchups }, leagueId, currentWeek, season }
//   -> { text: string (markdown) }
// Generates the free weekly matchup report.
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (rejectWrongMethod(req, res, "POST")) return;

  const body = (req.body ?? {}) as {
    data?: { leagueMetadata?: unknown; matchups?: unknown };
    currentWeek?: number;
    season?: string;
  };

  try {
    const text = await chat(
      [
        {
          role: "system",
          content:
            "You are a fantasy football beat writer. Given a week's matchups, write a lively " +
            "recap: summarize each matchup result, highlight the top and bottom performers, " +
            "biggest blowouts and closest games, and notable individual player performances. " +
            "Use markdown with headers and short paragraphs. Name real teams and players.",
        },
        {
          role: "user",
          content:
            `Week ${body.currentWeek ?? ""} of the ${body.season ?? ""} season.\n\n` +
            "League metadata:\n" +
            JSON.stringify(body.data?.leagueMetadata ?? {}).slice(0, 4000) +
            "\n\nMatchups:\n" +
            JSON.stringify(body.data?.matchups ?? []).slice(0, 14000),
        },
      ],
      { maxTokens: 1100 }
    );
    sendJson(res, 200, { text });
  } catch (error) {
    console.error("weekly-report error:", error);
    sendJson(res, 200, {
      text: "Unable to generate report. Please try again later.",
    });
  }
}
