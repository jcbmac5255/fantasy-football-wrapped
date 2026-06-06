import {
  ApiRequest,
  ApiResponse,
  rejectWrongMethod,
  requireUser,
  sendJson,
} from "./_lib/http";
import { textToSpeech } from "./_lib/openai";

// POST { text } -> audio/mpeg (mp3 bytes). Requires a signed-in user.
// Strips markdown so the narration sounds natural.
const stripMarkdown = (text: string): string =>
  text
    .replace(/[#*_`>~]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (rejectWrongMethod(req, res, "POST")) return;
  if (!(await requireUser(req, res))) return;

  const body = (req.body ?? {}) as { text?: string };
  const text = stripMarkdown(String(body.text ?? ""));
  if (!text) {
    sendJson(res, 400, { error: "No text provided." });
    return;
  }

  try {
    const audio = await textToSpeech(text);
    res.statusCode = 200;
    res.setHeader("Content-Type", "audio/mpeg");
    res.end(audio);
  } catch (error) {
    console.error("weekly-report-audio error:", error);
    sendJson(res, 500, {
      error: "Unable to generate audio recap right now. Please try again later.",
    });
  }
}
