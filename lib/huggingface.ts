import { InferenceClient } from "@huggingface/inference";

// Server-only. Never import this from a Client Component — it reads
// a secret token that must not reach the browser bundle.
export function getHuggingFaceClient() {
  const token = process.env.HF_TOKEN;
  if (!token) {
    throw new Error(
      "HF_TOKEN is not set. Add it to .env.local and restart the dev server."
    );
  }
  return new InferenceClient(token);
}
