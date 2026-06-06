import {
  ApiRequest,
  ApiResponse,
  rejectWrongMethod,
  sendJson,
} from "./_lib/http";
import { chat } from "./_lib/openai";

// POST { data: { leagueMetadata, teamData } } -> { text: string (markdown) }
// Generates a season-long league recap / summary.
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (rejectWrongMethod(req, res, "POST")) return;

  const body = (req.body ?? {}) as {
    data?: { leagueMetadata?: unknown; teamData?: unknown };
  };

  try {
    const text = await chat(
      [
        {
          role: "system",
          content:
            "You are an entertaining fantasy football commissioner writing a season recap " +
            "for a league. Be specific: name teams and managers, call out the best and worst " +
            "performers, biggest surprises, and rivalries. Write in markdown with short " +
            "paragraphs and the occasional bold highlight. Keep it under ~350 words.",
        },
        {
          role: "user",
          content:
            "League metadata:\n" +
            JSON.stringify(body.data?.leagueMetadata ?? {}).slice(0, 4000) +
            "\n\nTeam data:\n" +
            JSON.stringify(body.data?.teamData ?? []).slice(0, 12000),
        },
      ],
      { maxTokens: 800 }
    );
    sendJson(res, 200, { text });
  } catch (error) {
    console.error("league-recap error:", error);
    sendJson(res, 200, {
      text: "Unable to generate report. Please try again later.",
    });
  }
}
