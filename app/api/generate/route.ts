import { NextResponse } from "next/server";
import sharp from "sharp";
import { Type } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { getGeminiClient } from "@/lib/gemini";
import { resolveCloudflareCreds } from "@/lib/user-keys";
import type { RoomAnalysis, AnswersMap, Question } from "@/lib/types";

const CF_MODEL = "@cf/black-forest-labs/flux-2-dev";

const MAX_REFERENCE_DIMENSION = 512;
const OUTPUT_MAX_DIMENSION = 1024;
const MAX_VALIDATION_ATTEMPTS = 3;

const FRIENDLY_FAILURE_MESSAGE =
  "We couldn't generate a version that kept your room's structure intact after a few tries. This tends to happen with angled or wide-shot photos — try a straighter-on photo of the room, taken a bit further back, and give it another shot.";

// Thrown for Cloudflare auth/quota failures specifically, so the outer
// handler can give a "go add your own key" message instead of the
// generic structure-preservation failure message, and so the
// validation-retry loop below doesn't waste attempts retrying an error
// that a reinforced prompt can't fix.
class CloudflareGenerationError extends Error {
  status: number;
  usedUserKey: boolean;
  constructor(status: number, body: string, usedUserKey: boolean) {
    super(`Cloudflare Workers AI request failed (${status}): ${body}`);
    this.status = status;
    this.usedUserKey = usedUserKey;
  }
}

export async function POST(request: Request) {
  try {
    const { path, originalImageUrl, analysis, answers, questions, projectId } =
      (await request.json()) as {
        path: string;
        originalImageUrl: string;
        analysis: RoomAnalysis;
        answers: AnswersMap;
        questions: Question[];
        projectId?: string;
      };

    if (!path || !originalImageUrl || !analysis || !answers || !questions) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const creds = await resolveCloudflareCreds(user.id);
    if (!creds) {
      return NextResponse.json(
        {
          error:
            "No Cloudflare Workers AI key is configured. Add your own free key in Settings.",
        },
        { status: 500 }
      );
    }

    const basePrompt = buildPrompt(analysis, answers, questions);

    const originalRes = await fetch(originalImageUrl);
    if (!originalRes.ok) {
      throw new Error(
        `Could not download original image: ${originalRes.status}`
      );
    }
    const originalBuffer = Buffer.from(await originalRes.arrayBuffer());
    const originalMimeType =
      originalRes.headers.get("content-type") || "image/jpeg";
    const metadata = await sharp(originalBuffer).metadata();

    const { referenceBuffer, outputWidth, outputHeight } =
      await prepareImages(originalBuffer, metadata.width, metadata.height);

    // ── Phase 6 reliability loop: generate, validate structure, retry
    // with a reinforced prompt on failure, up to MAX_VALIDATION_ATTEMPTS.
    let finalImage: { buffer: Buffer; mimeType: string } | null = null;
    let lastReason = "";
    let attemptsUsed = 0;

    for (let attempt = 1; attempt <= MAX_VALIDATION_ATTEMPTS; attempt++) {
      attemptsUsed = attempt;
      const prompt =
        attempt === 1
          ? basePrompt
          : `${basePrompt}\n\nIMPORTANT: A previous attempt failed because: "${lastReason}". This time be extremely conservative — make ONLY furniture/decor/color changes and leave every architectural line exactly where it is in the original photo.`;

      const generated = await generateOnce(
        prompt,
        referenceBuffer,
        outputWidth,
        outputHeight,
        creds
      );

      const validation = await validateStructure(
        originalBuffer.toString("base64"),
        originalMimeType,
        generated.buffer.toString("base64"),
        generated.mimeType
      );

      if (validation.preserved) {
        finalImage = generated;
        break;
      }
      lastReason = validation.reason;
    }

    if (!finalImage) {
      await supabase.from("generation_logs").insert({
        user_id: user.id,
        project_id: projectId ?? null,
        attempts: attemptsUsed,
        success: false,
        final_reason: lastReason,
      });

      return NextResponse.json({ error: FRIENDLY_FAILURE_MESSAGE }, { status: 422 });
    }

    await supabase.from("generation_logs").insert({
      user_id: user.id,
      project_id: projectId ?? null,
      attempts: attemptsUsed,
      success: true,
      final_reason: null,
    });

    const ext = finalImage.mimeType.split("/")[1] || "png";
    const generatedPath = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("generated-images")
      .upload(generatedPath, finalImage.buffer, {
        contentType: finalImage.mimeType,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage
        .from("generated-images")
        .createSignedUrl(generatedPath, 60 * 60);

    if (signedUrlError || !signedUrlData) {
      throw signedUrlError ?? new Error("Could not create signed URL");
    }

    let versionNumber = 1;
    if (projectId) {
      const { count } = await supabase
        .from("generated_designs")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId);
      versionNumber = (count ?? 0) + 1;
    }

    const { error: dbError } = await supabase.from("generated_designs").insert({
      user_id: user.id,
      project_id: projectId ?? null,
      original_path: path,
      generated_path: generatedPath,
      room_type: analysis.roomType ?? null,
      style: analysis.style ?? null,
      renovation_intensity:
        (answers["renovation_intensity"] as string | undefined) ?? null,
      answers,
      questions_snapshot: questions,
      version_number: versionNumber,
    });
    if (dbError) {
      console.error("Could not save generated_designs row:", dbError);
    }

    return NextResponse.json({
      path: generatedPath,
      url: signedUrlData.signedUrl,
      projectId: projectId ?? null,
      attemptsUsed,
    });
  } catch (err) {
    console.error("Generate route error:", err);

    if (err instanceof CloudflareGenerationError) {
      const isAuthError = err.status === 401 || err.status === 403;
      const isQuotaError = err.status === 429;

      let message =
        "Something went wrong generating the design. Please try again.";
      if (isAuthError) {
        message = err.usedUserKey
          ? "Your saved Cloudflare key was rejected. Check it in Settings."
          : "The app's Cloudflare key isn't working right now.";
      } else if (isQuotaError) {
        message = err.usedUserKey
          ? "Your Cloudflare account has hit its daily free limit. Try again after 00:00 UTC."
          : "The app's shared free quota is used up for today. Add your own free Cloudflare key in Settings to keep generating.";
      }

      return NextResponse.json({ error: message }, { status: 502 });
    }

    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Something went wrong generating the design.",
      },
      { status: 500 }
    );
  }
}

function buildPrompt(
  analysis: RoomAnalysis,
  answers: AnswersMap,
  questions: Question[]
): string {
  const answerLines = questions
    .map((q) => {
      if (q.id === "renovation_intensity") return null;
      const a = answers[q.id];
      if (!a || (Array.isArray(a) && a.length === 0)) return null;
      const value = Array.isArray(a) ? a.join(", ") : a;
      return `- ${q.question}: ${value}`;
    })
    .filter(Boolean)
    .join("\n");

  const intensity = answers["renovation_intensity"];
  const intensityLine =
    typeof intensity === "string" && intensity.length > 0
      ? intensity
      : "Full refresh — swap everything (furniture, colors, decor)";

  return `This is a photo EDIT task, not a new scene generation. Image 0 is
the exact space to edit. Study its architecture carefully before changing
anything.

ABSOLUTE RULE — DO NOT VIOLATE: only edit furniture, decor, textiles, and
color. NEVER add, remove, or alter any structural or architectural element
that is not already visible in image 0. This specifically means: do not add
a roof, pergola, canopy, awning, gazebo, ceiling, ANY new wall, column,
arch, or fence that isn't already there. Do not change the space from
indoor to outdoor or outdoor to indoor. Do not change window or door
positions or counts. Do not change the camera angle, framing, or
perspective. If you are unsure whether something is "furniture/decor" or
"architecture", treat it as architecture and leave it untouched.

This space is: ${analysis.roomType}.
Its current style is: ${analysis.style}.
Existing furniture to replace: ${analysis.existingFurniture.join(", ")}.

Renovation intensity requested: ${intensityLine}

Additional homeowner preferences:
${answerLines || "(none specified)"}

Within those limits, fully replace the furniture, rugs/flooring textiles,
cushions, lighting fixtures, planters/plants, and decor with a photorealistic,
high-end interior/exterior design photography result. A result that only
shifts tone or lighting without swapping the actual furniture is a failed
result — but a result that adds architecture not present in image 0 is also
a failed result and is worse.

Reminder: keep identical to image 0 — walls, windows, doors, fences,
ceiling/sky, floor layout, and camera angle/perspective.`;
}

async function prepareImages(
  originalBuffer: Buffer,
  width?: number,
  height?: number
): Promise<{
  referenceBuffer: Buffer;
  outputWidth: number;
  outputHeight: number;
}> {
  const referenceBuffer = await sharp(originalBuffer)
    .resize(MAX_REFERENCE_DIMENSION, MAX_REFERENCE_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();

  const aspect = width && height ? width / height : 4 / 3;
  let outputWidth = OUTPUT_MAX_DIMENSION;
  let outputHeight = Math.round(outputWidth / aspect);
  if (outputHeight > OUTPUT_MAX_DIMENSION) {
    outputHeight = OUTPUT_MAX_DIMENSION;
    outputWidth = Math.round(outputHeight * aspect);
  }
  outputWidth = Math.min(1920, Math.max(256, outputWidth));
  outputHeight = Math.min(1920, Math.max(256, outputHeight));

  return { referenceBuffer, outputWidth, outputHeight };
}

// One call to Workers AI, with a small internal retry for transient
// failures only (network hiccups, momentary API errors) — separate from
// the outer structure-validation retry loop above. Auth/quota errors are
// NOT retried here since retrying won't fix them.
async function generateOnce(
  prompt: string,
  referenceImage: Buffer,
  width: number,
  height: number,
  creds: { accountId: string; apiToken: string; isUserOwned: boolean },
  attempt = 1
): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    const referenceArrayBuffer = referenceImage.buffer.slice(
      referenceImage.byteOffset,
      referenceImage.byteOffset + referenceImage.byteLength
    ) as ArrayBuffer;

    const form = new FormData();
    form.append("prompt", prompt);
    form.append(
      "input_image_0",
      new Blob([referenceArrayBuffer], { type: "image/png" }),
      "room.png"
    );
    form.append("width", String(width));
    form.append("height", String(height));
    form.append("steps", "30");
    form.append("guidance", "9");

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${creds.accountId}/ai/run/${CF_MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.apiToken}`,
        },
        body: form,
      }
    );

    if (res.status === 401 || res.status === 403 || res.status === 429) {
      const errText = await res.text();
      throw new CloudflareGenerationError(
        res.status,
        errText,
        creds.isUserOwned
      );
    }

    const data = await res.json();

    if (!res.ok || data?.success === false) {
      const message =
        data?.errors?.[0]?.message ||
        `Cloudflare Workers AI request failed (${res.status})`;
      throw new Error(message);
    }

    const base64Image: string | undefined = data?.result?.image;
    if (!base64Image) {
      throw new Error("Workers AI did not return a generated image.");
    }

    return {
      buffer: Buffer.from(base64Image, "base64"),
      mimeType: "image/png",
    };
  } catch (err) {
    if (err instanceof CloudflareGenerationError) {
      // Don't retry auth/quota failures — a retry burns more of the
      // (possibly limited) allocation without any chance of succeeding.
      throw err;
    }
    if (attempt < 2) {
      return generateOnce(
        prompt,
        referenceImage,
        width,
        height,
        creds,
        attempt + 1
      );
    }
    throw err;
  }
}

const VALIDATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    structurePreserved: { type: Type.BOOLEAN },
    reason: {
      type: Type.STRING,
      description: "One short sentence explaining the judgment",
    },
  },
  required: ["structurePreserved", "reason"],
};

// Phase 6 core check: cheap vision call comparing original vs generated,
// judging ONLY structural preservation — never decor taste.
async function validateStructure(
  originalBase64: string,
  originalMimeType: string,
  generatedBase64: string,
  generatedMimeType: string
): Promise<{ preserved: boolean; reason: string }> {
  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    // gemini-3.6-flash's free tier is only 20 requests/day total — this
    // validation call runs up to 3x per generation, so it exhausts fast.
    // Flash-Lite handles this simple yes/no structural check just as
    // well and has a much higher free daily quota (~1,500/day).
    model: "gemini-2.5-flash-lite",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Compare these two photos of the same physical space. Image 1 is
the ORIGINAL. Image 2 is an AI-edited RENOVATION of it. Your only job is to
check whether the room's physical structure was preserved — NOT whether you
like the new decor.

Structure means: wall positions, window count/placement, door count/placement,
ceiling/roof shape, overall room shape and proportions, and camera
angle/perspective. Furniture, colors, decor, and materials are EXPECTED to
change and should be ignored in your judgment.

If windows/doors were added, removed, or moved, or the room shape changed,
or the camera perspective shifted, or indoor/outdoor status changed, mark
it as NOT preserved.`,
          },
          { inlineData: { mimeType: originalMimeType, data: originalBase64 } },
          {
            inlineData: {
              mimeType: generatedMimeType,
              data: generatedBase64,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: VALIDATION_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    // If validation itself fails (not the generation), don't silently
    // block a possibly-good image — treat as preserved but say why.
    return { preserved: true, reason: "Validation call returned no output" };
  }

  const parsed = JSON.parse(text) as {
    structurePreserved: boolean;
    reason: string;
  };
  return { preserved: parsed.structurePreserved, reason: parsed.reason };
}