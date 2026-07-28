import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { getGeminiClient } from "@/lib/gemini";
import type { RoomAnalysis, Question } from "@/lib/types";

const QUESTIONS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "short snake_case identifier, e.g. 'style_preference'",
          },
          question: { type: Type.STRING },
          type: {
            type: Type.STRING,
            enum: ["single_select", "multi_select", "text"],
          },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-5 concrete options. Omit for type 'text'.",
          },
        },
        required: ["id", "question", "type"],
      },
    },
  },
  required: ["questions"],
};

const SYSTEM_PROMPT = `You are helping plan a home renovation. Based on the room
analysis provided, generate 5 short, specific questions to ask the homeowner
before designing a renovation for this exact space. Requirements:
- Questions must be relevant to what was actually observed in the room
  (its type, current furniture, and condition) — do not ask generic questions
  that could apply to any room.
- Include exactly one budget question (single_select, options as price ranges
  in USD, e.g. "Under $1,000", "$1,000-3,000", "$3,000-7,000", "$7,000+").
- Include a question about who uses/lives in the space.
- Include a question about desired style direction, with concrete style
  names as options (not vague terms).
- Include a question about what to keep vs. change.
- Include exactly one open-ended free-text question ("type": "text") for
  anything else the homeowner wants to mention.
- single_select and multi_select questions must have 3-5 concrete,
  mutually distinct options.`;

export async function POST(request: Request) {
  try {
    const { analysis } = (await request.json()) as { analysis: RoomAnalysis };
    if (!analysis) {
      return NextResponse.json({ error: "Missing analysis" }, { status: 400 });
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: SYSTEM_PROMPT },
            { text: `Room analysis:\n${JSON.stringify(analysis, null, 2)}` },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: QUESTIONS_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from model");

    const parsed = JSON.parse(text) as { questions: Question[] };
    return NextResponse.json(parsed.questions);
  } catch (err) {
    console.error("Questions route error:", err);
    return NextResponse.json(
      { error: "Could not generate questions. Please try again." },
      { status: 500 }
    );
  }
}
