import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runGroqChat, parseJsonResponse, GroqError } from "@/lib/groq";
import type { RoomAnalysis, Question } from "@/lib/types";

const TEXT_MODEL = "openai/gpt-oss-20b";

function buildPrompt(analysis: RoomAnalysis): string {
  return `Given this room analysis:
${JSON.stringify(analysis, null, 2)}

Generate 4 to 6 short, relevant questions to ask the homeowner before
renovating this specific room — questions should make sense for this room
type (e.g. don't ask about "sofa style" for a kitchen). Each question needs
a type of "single_select", "multi_select", or "text":
- Use "single_select" when only one answer makes sense (e.g. overall style
  direction, budget range).
- Use "multi_select" whenever more than one choice could reasonably apply
  at once (e.g. "which current elements would you like to keep?", "who
  will primarily use this space?") — don't force these into single_select.
- single_select and multi_select need an "options" array of 3-5 short
  choices; "text" needs no options.

Respond with a JSON object in exactly this shape:

{
  "questions": [
    {
      "id": "short_snake_case_id",
      "question": "The question text",
      "type": "single_select",
      "options": ["Option A", "Option B", "Option C"]
    }
  ]
}`;
}

export async function POST(request: Request) {
  try {
    const { analysis } = (await request.json()) as { analysis: RoomAnalysis };
    if (!analysis) {
      return NextResponse.json({ error: "Missing analysis" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const text = await runGroqChat(
      TEXT_MODEL,
      [{ role: "user", content: buildPrompt(analysis) }],
      true // json mode
    );

    const parsed = parseJsonResponse<{ questions: Question[] }>(text);
    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error("Model returned no questions");
    }

    return NextResponse.json(parsed.questions);
  } catch (err) {
    console.error("Questions route error:", err);

    if (err instanceof GroqError) {
      const message =
        err.status === 429
          ? "Groq's free tier rate limit was hit. Wait a moment and try again."
          : err.status === 401
          ? "GROQ_API_KEY looks invalid. Check it in .env.local."
          : "Could not generate questions. Try again.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    return NextResponse.json(
      { error: "Couldn't put together questions for this room. Try again." },
      { status: 500 }
    );
  }
}