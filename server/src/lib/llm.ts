
// server/src/lib/llm.ts
import { GoogleGenerativeAI, type Content } from "@google/generative-ai";

const GEMINI_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_GEMINI_API_KEY ||
  "";

if (!GEMINI_KEY) {
  throw new Error("Gemini API key missing. Set GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY in server/.env");
}

const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

function tryParseJson(text: string): any | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function extractJson(rawText: string): any {
  const trimmed = rawText.trim();

  // 1) Fenced ```json ... ```
  const fencedMatch = /```json\s*([\s\S]*?)```/i.exec(trimmed);
  if (fencedMatch && typeof fencedMatch[1] === "string") {
    const parsed = tryParseJson(fencedMatch[1]);
    if (parsed !== undefined) return parsed;
  }

  // 2) First {...} or [...]
  const blockMatch = /(\{[\s\S]*\}|\[[\s\S]*\])/m.exec(trimmed);
  if (blockMatch && typeof blockMatch[1] === "string") {
    const parsed = tryParseJson(blockMatch[1]);
    if (parsed !== undefined) return parsed;
  }

  // 3) Last resort: try the whole string
  const whole = tryParseJson(trimmed);
  if (whole !== undefined) return whole;

  // 4) Give back raw for caller to handle
  return { raw: trimmed };
}

/**
 * Ask Gemini and parse JSON from the response.
 * Accepts either a single prompt, or (system, user) which are concatenated.
 */
export async function askLLMJson(systemOrPrompt: string, maybeUser?: string): Promise<any> {
  const sys = systemOrPrompt ?? "";
  const usr = maybeUser ?? "";
  const prompt = usr ? `${sys}\n\nUser: ${usr}` : sys;

  const contents: Content[] = [
    { role: "user", parts: [{ text: prompt }] },
  ];

  const resp = await model.generateContent({ contents });
  const rawText = resp.response.text();
  return extractJson(rawText);
}

/** Simple text helper if you need it */
export async function askLLMText(prompt: string): Promise<string> {
  const contents: Content[] = [{ role: "user", parts: [{ text: prompt }] }];
  const resp = await model.generateContent({ contents });
  return resp.response.text();
}