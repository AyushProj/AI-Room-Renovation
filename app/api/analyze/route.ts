import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runGroqChat, parseJsonResponse, GroqError } from "@/lib/groq";
import type { RoomAnalysis } from "@/lib/types";

const VISION_MODEL = "qwen/qwen3.6-27b";

const PROMPT = `Look at this room photo and respond with a JSON object matching exactly this shape:

{
  "roomType": "string, e.g. living room, kitchen, outdoor patio",
  "style": "string, current decorating style, e.g. modern bohemian",
  "existingFurniture": ["array of distinct furniture/decor items visible"],
  "lighting": "string, brief description of the lighting",
  "condition": "string, e.g. excellent, dated, worn",
  "dominantColors": ["2 to 4 dominant colors in the room"],
  "notes": "string, anything else worth noting, or an empty string"
}`;

export async function POST(request: Request) {
  try {
    const { path } = (await request.json()) as { path: string };
    if (!path) {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("room-images")
      .download(path);

    if (downloadError || !fileBlob) {
      return NextResponse.json(
        { error: "Could not load the uploaded image" },
        { status: 404 }
      );
    }

    const arrayBuffer = await fileBlob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = fileBlob.type || "image/jpeg";

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
      true // json mode
    );

    const analysis = parseJsonResponse<RoomAnalysis>(text);
    return NextResponse.json(analysis);
  } catch (err) {
    console.error("Analyze route error:", err);

    if (err instanceof GroqError) {
      const message =
        err.status === 429
          ? "Groq's free tier rate limit was hit. Wait a moment and try again."
          : err.status === 401
          ? "GROQ_API_KEY looks invalid. Check it in .env.local."
          : "Could not analyze this photo. Try again.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    return NextResponse.json(
      {
        error:
          "Couldn't read this photo. Try a clearer, well-lit shot of the room.",
      },
      { status: 500 }
    );
  }
}