import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { RoomAnalysis } from "@/lib/types";

// File location: app/api/projects/route.ts
// Called once, right after /api/analyze succeeds, to create the
// "timeline root" that every generated version will attach to.

export async function POST(request: Request) {
  try {
    const { path, analysis } = (await request.json()) as {
      path: string;
      analysis: RoomAnalysis;
    };

    if (!path || !analysis) {
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

    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        original_path: path,
        room_type: analysis.roomType ?? null,
        style: analysis.style ?? null,
        existing_furniture: analysis.existingFurniture ?? [],
        lighting: analysis.lighting ?? null,
        condition: analysis.condition ?? null,
        dominant_colors: analysis.dominantColors ?? [],
        notes: analysis.notes ?? null,
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ projectId: data.id });
  } catch (err) {
    console.error("Create project route error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Something went wrong creating the project.",
      },
      { status: 500 }
    );
  }
}