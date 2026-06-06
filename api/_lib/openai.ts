// Minimal OpenAI REST client used by the AI serverless functions.
// Uses fetch directly so we don't pull in the SDK (smaller cold starts).
// Requires the server-side env var OPENAI_API_KEY (never a VITE_ var).

const OPENAI_BASE = "https://api.openai.com/v1";

const getApiKey = (): string => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }
  return key;
};

export const CHAT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
export const TTS_MODEL = process.env.OPENAI_TTS_MODEL ?? "tts-1";
export const TTS_VOICE = process.env.OPENAI_TTS_VOICE ?? "alloy";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ChatOptions = {
  maxTokens?: number;
  temperature?: number;
  /** When true, ask the model for a strict JSON object response. */
  json?: boolean;
};

export const chat = async (
  messages: ChatMessage[],
  { maxTokens = 900, temperature = 0.8, json = false }: ChatOptions = {}
): Promise<string> => {
  const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI chat request failed (${response.status}): ${detail}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return payload.choices?.[0]?.message?.content?.trim() ?? "";
};

// Parse a JSON object out of a model response, tolerating ```json fences.
export const parseJsonResponse = <T>(raw: string): T => {
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
};

// Text-to-speech. Returns raw mp3 bytes.
export const textToSpeech = async (text: string): Promise<Buffer> => {
  const response = await fetch(`${OPENAI_BASE}/audio/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: text.slice(0, 4000), // API hard limit is 4096 chars
      format: "mp3",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI TTS request failed (${response.status}): ${detail}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};
