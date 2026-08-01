import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { getGeminiClient } from "@/lib/gemini";
import type { ExtractedItem } from "@/lib/types";

const ITEMS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: {
            type: Type.STRING,
            description:
              "Short, product-search-friendly description, e.g. 'beige linen 3-seat sofa'",
          },
          x: {
            type: Type.NUMBER,
            description: "Normalized horizontal center position, 0 (left) to 1 (right)",
          },
          y: {
            type: Type.NUMBER,
            description: "Normalized vertical center position, 0 (top) to 1 (bottom)",
          },
        },
        required: ["label", "x", "y"],
      },
    },
  },
  required: ["items"],
};

export async function POST(request: Request) {
  try {
    const { imageUrl } = (await request.json()) as { imageUrl: string };
    if (!imageUrl) {
      return NextResponse.json({ error: "Missing imageUrl" }, { status: 400 });
    }

    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      throw new Error(`Could not load image: ${imageRes.status}`);
    }
    const arrayBuffer = await imageRes.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = imageRes.headers.get("content-type") || "image/png";

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      // gemini-3.6-flash's free tier is only 20 requests/day total,
      // shared with the structure-validation call in /api/generate.
      // This is a simple single-image item listing — Flash-Lite handles
      // it fine and has a much higher free daily quota (~1,500/day).
      model: "gemini-2.5-flash-lite",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Identify 4 to 8 distinct, individually purchasable furniture or
decor items clearly visible in this room photo. For each, give a short,
concrete, product-search-friendly label (include material/color when
visible, e.g. "beige linen 3-seat sofa", "brass arc floor lamp", "round
rattan coffee table") and its approximate center position in the image as
normalized x/y coordinates, where (0,0) is the top-left corner and (1,1)
is the bottom-right corner. Do not include structural elements like walls,
windows, floors, or ceilings.`,
            },
            { inlineData: { mimeType, data: base64Data } },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: ITEMS_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from model");

    const parsed = JSON.parse(text) as { items: ExtractedItem[] };
    return NextResponse.json(parsed.items);
  } catch (err) {
    console.error("Extract items route error:", err);
    return NextResponse.json(
      { error: "Could not identify items in this image." },
      { status: 500 }
    );
  }
}