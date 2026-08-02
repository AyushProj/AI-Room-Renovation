import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runGroqChat, parseJsonResponse, GroqError } from "@/lib/groq";
import type { ExtractedItem } from "@/lib/types";

const VISION_MODEL = "qwen/qwen3.6-27b";

const PROMPT = `Identify 4 to 8 distinct, individually purchasable furniture or
decor items clearly visible in this room photo. For each, give a short,
concrete, product-search-friendly label (include material/color when
visible, e.g. "beige linen 3-seat sofa", "brass arc floor lamp", "round
rattan coffee table") and its approximate center position in the image as
normalized x/y coordinates, where (0,0) is the top-left corner and (1,1)
is the bottom-right corner. Do not include structural elements like walls,
windows, floors, or ceilings.

Respond directly with ONLY the JSON object below — no explanation, no
reasoning, no text before or after it:

{
  "items": [
    { "label": "beige linen 3-seat sofa", "x": 0.4, "y": 0.6 }
  ]
}`;

export async function POST(request: Request) {
  try {
    const { imageUrl } = (await request.json()) as { imageUrl: string };
    if (!imageUrl) {
      return NextResponse.json({ error: "Missing imageUrl" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      throw new Error(`Could not load image: ${imageRes.status}`);
    }
    const arrayBuffer = await imageRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = imageRes.headers.get("content-type") || "image/png";

    const text = await runGroqChat(
      VISION_MODEL,
      [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        },
      ],
      true
    );

    const parsed = parseJsonResponse<{ items: ExtractedItem[] }>(text);
    if (!Array.isArray(parsed.items)) {
      throw new Error("Model returned no items array");
    }

    return NextResponse.json(parsed.items);
  } catch (err) {
    console.error("Extract items route error:", err);

    if (err instanceof GroqError) {
      const message =
        err.status === 429
          ? "Groq's free tier rate limit was hit. Wait a moment and try again."
          : err.status === 401
          ? "GROQ_API_KEY looks invalid. Check it in .env.local."
          : "Could not identify items in this image.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    return NextResponse.json(
      { error: "Could not identify items in this image." },
      { status: 500 }
    );
  }
}
