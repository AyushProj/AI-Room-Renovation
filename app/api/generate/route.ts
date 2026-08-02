import { NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import type { RoomAnalysis, AnswersMap, Question } from "@/lib/types";

// FLUX.2 on Workers AI requires each reference image to be <= 512x512,
// takes multipart form-data, and returns { result: { image: base64 } }.
// Docs: https://developers.cloudflare.com/workers-ai/models/flux-2-dev/
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

const CF_MODEL = "@cf/black-forest-labs/flux-2-dev";
const CF_RUN_URL = CLOUDFLARE_ACCOUNT_ID
  ? `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${CF_MODEL}`
  : null;

const MAX_REFERENCE_DIMENSION = 512;
const OUTPUT_MAX_DIMENSION = 1024;

// Vercel Hobby default is 10s — generation regularly runs longer than
// that, so this is required, not optional. See VERCEL_DEPLOYMENT.md.
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let projectIdForLogging: string | null = null;

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
    projectIdForLogging = projectId ?? null;

    if (!path || !originalImageUrl || !analysis || !answers || !questions) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN || !CF_RUN_URL) {
      return NextResponse.json(
        {
          error:
            "CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN is not set on the server.",
        },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const prompt = buildPrompt(analysis, answers, questions);

    const originalRes = await fetch(originalImageUrl);
    if (!originalRes.ok) {
      throw new Error(
        `Could not download original image: ${originalRes.status}`
      );
    }
    const originalBuffer = Buffer.from(await originalRes.arrayBuffer());
    const metadata = await sharp(originalBuffer).metadata();

    const { referenceBuffer, outputWidth, outputHeight } =
      await prepareImages(originalBuffer, metadata.width, metadata.height);

    let imageBuffer: Buffer;
    let mimeType: string;

    try {
      const result = await callFlux(
        prompt,
        referenceBuffer,
        outputWidth,
        outputHeight
      );
      imageBuffer = result.buffer;
      mimeType = result.mimeType;
    } catch (genErr) {
      await supabase.from("generation_logs").insert({
        user_id: user.id,
        project_id: projectId ?? null,
        succeeded: false,
        attempts: 1,
        failure_reason:
          genErr instanceof Error ? genErr.message : "Unknown error",
      });

      return NextResponse.json(
        {
          error:
            genErr instanceof Error
              ? genErr.message
              : "Something went wrong generating the design.",
        },
        { status: 500 }
      );
    }

    const ext = mimeType.split("/")[1] || "png";
    const generatedPath = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("generated-images")
      .upload(generatedPath, imageBuffer, {
        contentType: mimeType,
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

    const { data: insertedVersion, error: dbError } = await supabase
      .from("generated_designs")
      .insert({
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
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("Could not save generated_designs row:", dbError);
    }

    await supabase.from("generation_logs").insert({
      user_id: user.id,
      project_id: projectId ?? null,
      succeeded: true,
      attempts: 1,
      failure_reason: null,
    });

    return NextResponse.json({
      path: generatedPath,
      url: signedUrlData.signedUrl,
      projectId: projectId ?? null,
      versionId: insertedVersion?.id ?? null,
    });
  } catch (err) {
    console.error("Generate route error:", err);
    if (user) {
      await supabase.from("generation_logs").insert({
        user_id: user.id,
        project_id: projectIdForLogging,
        succeeded: false,
        attempts: 1,
        failure_reason: err instanceof Error ? err.message : "Unknown error",
      });
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

async function callFlux(
  prompt: string,
  referenceImage: Buffer,
  width: number,
  height: number,
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
    form.append("steps", "20");
    form.append("guidance", "9");

    const res = await fetch(CF_RUN_URL as string, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      body: form,
    });

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
    if (attempt < 2) {
      return callFlux(prompt, referenceImage, width, height, attempt + 1);
    }
    throw err;
  }
}