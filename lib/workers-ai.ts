import { resolveCloudflareCreds } from "@/lib/user-keys";

export class WorkersAIError extends Error {
  status: number;
  usedUserKey: boolean;
  isModelAgreementRequired: boolean;
  constructor(
    status: number,
    body: string,
    usedUserKey: boolean,
    isModelAgreementRequired = false
  ) {
    super(`Workers AI request failed (${status}): ${body}`);
    this.status = status;
    this.usedUserKey = usedUserKey;
    this.isModelAgreementRequired = isModelAgreementRequired;
  }
}

async function runWorkersAI(
  userId: string,
  model: string,
  input: Record<string, unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const creds = await resolveCloudflareCreds(userId);
  if (!creds) {
    throw new Error(
      "No Cloudflare Workers AI key is configured. Add your own free key in Settings."
    );
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${creds.accountId}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    }
  );

  if (res.status === 401 || res.status === 403 || res.status === 429) {
    const errText = await res.text();
    // Cloudflare error code 5016 is specifically "you must accept this
    // model's license agreement first" — a one-time per-account gate,
    // not an actual auth failure. Surface it distinctly so it doesn't
    // get misdiagnosed as "your key is wrong."
    let isModelAgreementRequired = false;
    try {
      const parsed = JSON.parse(errText);
      isModelAgreementRequired = parsed?.errors?.[0]?.code === 5016;
    } catch {
      // errText wasn't JSON — fall through, treat as a normal auth error.
    }
    throw new WorkersAIError(
      res.status,
      errText,
      creds.isUserOwned,
      isModelAgreementRequired
    );
  }

  const data = await res.json();
  if (!res.ok || data?.success === false) {
    const message =
      data?.errors?.[0]?.message ||
      `Workers AI request failed (${res.status})`;
    throw new Error(message);
  }

  return data.result;
}

// Text-only chat completion.
export async function runWorkersAIText(
  userId: string,
  model: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const result = await runWorkersAI(userId, model, { messages });
  const text: string | undefined = result?.response;
  if (!text) throw new Error("Workers AI returned an empty response.");
  return text;
}

// Vision call. IMPORTANT: Cloudflare's own vision models (like
// llama-3.2-11b-vision-instruct) take the image as a top-level `image`
// field — a plain array of byte values — NOT an OpenAI-style base64
// data URI inside `messages`. Cloudflare's own published code samples
// for this were reported broken (cloudflare-docs issue #19185); this is
// the community-confirmed working shape.
export async function runWorkersAIVision(
  userId: string,
  model: string,
  prompt: string,
  imageBuffer: Buffer
): Promise<string> {
  const image = Array.from(new Uint8Array(imageBuffer));
  const result = await runWorkersAI(userId, model, { image, prompt });
  const text: string | undefined = result?.response ?? result?.description;
  if (!text) throw new Error("Workers AI returned an empty response.");
  return text;
}

// Strips ```json fences some models add despite instructions not to,
// then parses. Throws if it still isn't valid JSON — callers should
// retry once with a stricter prompt on failure, since these models
// don't have Gemini-style schema-enforced JSON output.
export function parseJsonResponse<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}