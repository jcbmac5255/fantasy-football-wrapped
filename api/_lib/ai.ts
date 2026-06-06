// All AI generation logic, kept separate from the route handler so the seven
// AI features can share a single serverless function (api/ai.ts) while staying
// readable. Each run* function takes the request body and returns the payload
// the frontend expects.
import { chat, parseJsonResponse, textToSpeech } from "./openai.js";

export const runTrends = async (body: {
  data?: unknown;
  wordLimit?: number;
  bulletCount?: number;
  leagueState?: string;
}): Promise<{ bulletPoints: string[] }> => {
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
    return { bulletPoints };
  } catch (error) {
    console.error("trends error:", error);
    return { bulletPoints: [] };
  }
};

export const runLeagueRecap = async (body: {
  data?: { leagueMetadata?: unknown; teamData?: unknown };
}): Promise<{ text: string }> => {
  try {
    const text = await chat(
      [
        {
          role: "system",
          content:
            "You are an entertaining fantasy football columnist writing a season recap " +
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
    return { text };
  } catch (error) {
    console.error("league-recap error:", error);
    return { text: "Unable to generate report. Please try again later." };
  }
};

export const runWeeklyReport = async (body: {
  data?: { leagueMetadata?: unknown; matchups?: unknown };
  currentWeek?: number;
  season?: string;
}): Promise<{ text: string }> => {
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
    return { text };
  } catch (error) {
    console.error("weekly-report error:", error);
    return { text: "Unable to generate report. Please try again later." };
  }
};

const STYLE_GUIDES: Record<string, string> = {
  default: "balanced, informative sports-writer tone",
  funny: "comedic and irreverent, lots of jokes and roasts",
  dramatic: "epic, over-the-top sports-drama narration",
  analytical: "data-driven and analytical, citing numbers and efficiency",
  trash_talk: "merciless trash talk aimed at the losing teams",
};

export const runPremiumReport = async (body: {
  data?: { leagueMetadata?: unknown; matchups?: unknown };
  commentaryStyle?: string;
}): Promise<{ text: string }> => {
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
    return { text };
  } catch (error) {
    console.error("premium-report error:", error);
    return {
      text: "Unable to generate premium report right now. Please try again later.",
    };
  }
};

export const runWeeklyPreview = async (body: {
  data?: unknown;
}): Promise<{ text: string }> => {
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
    return { text };
  } catch (error) {
    console.error("weekly-preview error:", error);
    return { text: "Unable to generate preview. Please try again later." };
  }
};

type Manager = { userId: string; name: string; [key: string]: unknown };

export const runManagerProfiles = async (body: {
  data?: { league?: unknown; managers?: Manager[] };
}): Promise<{ blurbs: { userId: string; name: string; blurb: string }[] }> => {
  const managers = Array.isArray(body.data?.managers) ? body.data!.managers : [];
  if (managers.length === 0) return { blurbs: [] };

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
  const blurbs = managers.map((m) => ({
    userId: m.userId,
    name: m.name,
    blurb: byUser.get(m.userId) ?? "",
  }));
  return { blurbs };
};

const stripMarkdown = (text: string): string =>
  text
    .replace(/[#*_`>~]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();

export const runAudio = async (body: { text?: string }): Promise<Buffer> => {
  const text = stripMarkdown(String(body.text ?? ""));
  if (!text) throw new Error("No text provided.");
  return textToSpeech(text);
};
