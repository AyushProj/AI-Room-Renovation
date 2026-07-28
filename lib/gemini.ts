import { GoogleGenAI } from "@google/genai";

// Server-only. Never import this from a Client Component — it reads
// a secret API key that must not reach the browser bundle.
export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server."
    );
  }
  return new GoogleGenAI({ apiKey });
}
