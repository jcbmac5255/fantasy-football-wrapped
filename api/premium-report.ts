import {
  ApiRequest,
  ApiResponse,
  rejectWrongMethod,
  requireUser,
  sendJson,
} from "./_lib/http";
import { chat } from "./_lib/openai";

// POST { data: { leagueMetadata, matchups }, commentaryStyle } -> { text: markdown }
// Premium weekly report with a selectable commentary style. Requires a signed-in
// user (free login) so the OpenAI usage can't be triggered anonymously.
const STYLE_GUIDES: Record<string, string> = {
  default: "balanced, informative sports-writer tone",
  funny: "comedic and irreverent, lots of jokes and roasts",
  dramatic: "epic, over-the-top sports-drama narration",
  analytical: "data-driven and analytical, citing numbers and efficiency",
  trash_talk: "merciless trash talk aimed at the losing teams",
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (rejectWrongMethod(req, res, "POST")) return;
  if (!(await requireUser(req, res))) return;

  const body = (req.body ?? {}) as {
    data?: { leagueMetadata?: unknown; matchups?: unknown };
    commentaryStyle?: string;
  };
  const style =
    STYLE_GUIDES[body.commentaryStyle ?? "default"] ?? STYLE_GUIDES.default;

  try {
    const text = await chat(
      [
        {
          role: "system",
          content:
            "You are a premium fantasy football columnist. Write an in-depth weekly report " +
            `in a ${style} style. Cover every matchup, MVPs and busts, surprising results, ` +
            "and a look ahead. Use rich markdown (headers, bold, lists). Name real teams and players.",
        },
        {
          role: "user",
          content:
            "League metadata:\n" +
            JSON.stringify(body.data?.leagueMetadata ?? {}).slice(0, 4000) +
            "\n\nMatchups:\n" +
            JSON.stringify(body.data?.matchups ?? []).slice(0, 16000),
        },
      ],
      { maxTokens: 1500 }
    );
    sendJson(res, 200, { text });
  } catch (error) {
    console.error("premium-report error:", error);
    sendJson(res, 200, {
      text: "Unable to generate premium report right now. Please try again later.",
    });
  }
}
