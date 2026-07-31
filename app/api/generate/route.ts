import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { createClient } from "@/lib/supabase/server";
import type { RoomAnalysis, AnswersMap, Question } from "@/lib/types";

// fal reads FAL_KEY from the environment automatically, but being
// explicit here fails fast with a clear error if it's missing.
if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

const FAL_MODEL = "fal-ai/flux-kontext/dev";

export async function POST(request: Request) {
  try {
    const { path, originalImageUrl, analysis, answers, questions } =
      (await request.json()) as {
        path: string;
        originalImageUrl: string;
        analysis: RoomAnalysis;
        answers: AnswersMap;
        questions: Question[];
      };

    if (!path || !originalImageUrl || !analysis || !answers || !questions) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json(
        { error: "FAL_KEY is not set on the server." },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const prompt = buildPrompt(analysis, answers, questions);

    const generatedImageUrl = await generateWithRetry(
      prompt,
      originalImageUrl
    );

    // Download fal's result and re-host it in our own Supabase bucket,
    // same as before, so /projects can reload it later without relying
    // on fal's temporary file URLs.
    const imageRes = await fetch(generatedImageUrl);
    if (!imageRes.ok) {
      throw new Error(`Could not download generated image: ${imageRes.status}`);
    }
    const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
    const contentType = imageRes.headers.get("content-type") || "image/png";
    const ext = contentType.split("/")[1] || "png";
    const generatedPath = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("generated-images")
      .upload(generatedPath, imageBuffer, {
        contentType,
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

    return NextResponse.json({
      path: generatedPath,
      url: signedUrlData.signedUrl,
    });
  } catch (err) {
    console.error("Generate route error:", err);
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
      const a = answers[q.id];
      if (!a || (Array.isArray(a) && a.length === 0)) return null;
      const value = Array.isArray(a) ? a.join(", ") : a;
      return `- ${q.question}: ${value}`;
    })
    .filter(Boolean)
    .join("\n");

  return `Full interior design renovation of this room — replace the furniture,
decor, textiles, materials, and color palette entirely. This must look like a
different set of furniture was moved in, not a color/lighting adjustment.

MANDATORY (keep identical): wall positions, window placements, door locations,
ceiling height, floor layout, camera angle/perspective.

MANDATORY (must change): furniture, rugs, curtains, cushions, lighting
fixtures, wall paint color, plants, and decor. A result that only shifts
tone or lighting without swapping the actual furniture is a failed result.

Current furniture to replace: ${analysis.existingFurniture.join(", ")}
Current style: ${analysis.style}

Homeowner's preferences:
${answerLines}

Photorealistic, high-end interior design photography style.`;
}

async function generateWithRetry(
  prompt: string,
  imageUrl: string,
  attempt = 1
): Promise<string> {
  try {
    const result = await fal.subscribe(FAL_MODEL, {
      input: {
        prompt,
        image_url: imageUrl,
      },
      logs: false,
    });

    const image = result.data?.images?.[0];
    if (!image?.url) {
      throw new Error("fal.ai did not return a generated image.");
    }

    return image.url;
  } catch (err) {
    if (attempt < 2) {
      // One retry for transient failures. Structure-preservation
      // validation and smarter retries land in Phase 6.
      return generateWithRetry(prompt, imageUrl, attempt + 1);
    }
    throw err;
  }
}