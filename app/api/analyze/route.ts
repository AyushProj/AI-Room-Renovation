import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { getGeminiClient } from "@/lib/gemini";
import type { RoomAnalysis } from "@/lib/types";

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    roomType: {
      type: Type.STRING,
      description: "e.g. living room, bedroom, kitchen, home office",
    },
    existingFurniture: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Short list of furniture/items visible in the photo",
    },
    style: {
      type: Type.STRING,
      description: "Current decor style, e.g. modern, traditional, sparse",
    },
    lighting: {
      type: Type.STRING,
      description: "Natural/artificial lighting conditions observed",
    },
    condition: {
      type: Type.STRING,
      description: "Overall condition/state of the space",
    },
    dominantColors: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    notes: {
      type: Type.STRING,
      description: "Any other observations relevant to a renovation",
    },
  },
  required: [
    "roomType",
    "existingFurniture",
    "style",
    "lighting",
    "condition",
    "dominantColors",
    "notes",
  ],
};

const SYSTEM_PROMPT = `You are an interior design assistant. Analyze the room photo
and describe exactly what you observe. Be concrete and specific rather than
generic. Do not invent details you cannot see in the image.`;

export async function POST(request: Request) {
  try {
    const { path } = await request.json();
    if (!path || typeof path !== "string") {
      return NextResponse.json({ error: "Missing image path" }, { status: 400 });
    }

    // Require an authenticated user, and rely on Supabase Storage RLS
    // (Phase 2 policies) to ensure they can only download their own file.
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
    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = fileBlob.type || "image/jpeg";

    const analysis = await analyzeWithRetry(base64Data, mimeType);

    return NextResponse.json(analysis);
  } catch (err) {
    console.error("Analyze route error:", err);
    return NextResponse.json(
      { error: "Something went wrong analyzing the image. Please try again." },
      { status: 500 }
    );
  }
}

async function analyzeWithRetry(
  base64Data: string,
  mimeType: string,
  attempt = 1
): Promise<RoomAnalysis> {
  const ai = getGeminiClient();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: SYSTEM_PROMPT },
            { inlineData: { mimeType, data: base64Data } },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from model");

    return JSON.parse(text) as RoomAnalysis;
  } catch (err) {
    if (attempt < 2) {
      // Transient failures (bad JSON, timeout) get one retry before
      // we give up and surface an error to the user.
      return analyzeWithRetry(base64Data, mimeType, attempt + 1);
    }
    throw err;
  }
}
