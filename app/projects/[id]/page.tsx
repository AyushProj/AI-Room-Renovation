import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RoomAnalysis, Question } from "@/lib/types";
import RegenerateSection from "./RegenerateSection";

// File location: app/projects/[id]/page.tsx

interface ProjectRow {
  id: string;
  original_path: string;
  room_type: string | null;
  style: string | null;
  existing_furniture: string[] | null;
  lighting: string | null;
  condition: string | null;
  dominant_colors: string[] | null;
  notes: string | null;
  created_at: string;
}

interface VersionRow {
  id: string;
  generated_path: string;
  answers: Record<string, string | string[]> | null;
  questions_snapshot: Question[] | null;
  version_number: number | null;
  created_at: string;
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "id, original_path, room_type, style, existing_furniture, lighting, condition, dominant_colors, notes, created_at"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    notFound();
  }

  const typedProject = project as ProjectRow;

  const { data: versionRows, error: versionsError } = await supabase
    .from("generated_designs")
    .select("id, generated_path, answers, questions_snapshot, version_number, created_at")
    .eq("project_id", id)
    .order("version_number", { ascending: true });

  if (versionsError) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-red-600">
          Could not load this project&apos;s history: {versionsError.message}
        </p>
      </div>
    );
  }

  const versions = (versionRows ?? []) as VersionRow[];

  const { data: originalSigned } = await supabase.storage
    .from("room-images")
    .createSignedUrl(typedProject.original_path, 60 * 60);

  const versionsWithUrls = await Promise.all(
    versions.map(async (v) => {
      const { data: signed } = await supabase.storage
        .from("generated-images")
        .createSignedUrl(v.generated_path, 60 * 60);
      return { ...v, url: signed?.signedUrl ?? null };
    })
  );

  // Reconstruct the RoomAnalysis shape the generator route expects, so
  // "make more changes" can call /api/questions and /api/generate again
  // without re-running vision analysis on the photo.
  const analysis: RoomAnalysis = {
    roomType: typedProject.room_type ?? "room",
    style: typedProject.style ?? "",
    existingFurniture: typedProject.existing_furniture ?? [],
    lighting: typedProject.lighting ?? "",
    condition: typedProject.condition ?? "",
    dominantColors: typedProject.dominant_colors ?? [],
    notes: typedProject.notes ?? undefined,
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <Link
          href="/projects"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← My Projects
        </Link>
        <h1 className="text-sm font-semibold text-gray-900">
          {typedProject.room_type ?? "Room"} · {typedProject.style ?? ""}
        </h1>
      </div>

      <div className="space-y-6">
        {/* Step 0: the original photo */}
        <TimelineCard label="Original photo">
          {originalSigned?.signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={originalSigned.signedUrl}
              alt="Original room"
              className="w-full object-cover"
            />
          ) : (
            <div className="flex h-48 items-center justify-center text-xs text-gray-400">
              Image link expired
            </div>
          )}
        </TimelineCard>

        {/* Steps 1..N: each version, with the changes that produced it */}
        {versionsWithUrls.map((v) => (
          <div key={v.id} className="space-y-3">
            <ChangesCard version={v} />
            <TimelineCard label={`Version ${v.version_number ?? "?"}`}>
              {v.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={v.url}
                  alt={`Generated version ${v.version_number}`}
                  className="w-full object-cover"
                />
              ) : (
                <div className="flex h-48 items-center justify-center text-xs text-gray-400">
                  Image link expired
                </div>
              )}
            </TimelineCard>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <RegenerateSection
          projectId={typedProject.id}
          originalImagePath={typedProject.original_path}
          originalImageUrl={originalSigned?.signedUrl ?? ""}
          analysis={analysis}
        />
      </div>
    </div>
  );
}

function TimelineCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <p className="border-b border-gray-100 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </p>
      {children}
    </div>
  );
}

function ChangesCard({ version }: { version: VersionRow }) {
  const { answers, questions_snapshot } = version;
  if (!answers || !questions_snapshot || questions_snapshot.length === 0) {
    return null;
  }

  const rows = questions_snapshot
    .map((q) => {
      const value = answers[q.id];
      if (!value || (Array.isArray(value) && value.length === 0)) return null;
      return {
        label: q.question,
        value: Array.isArray(value) ? value.join(", ") : value,
      };
    })
    .filter(Boolean) as { label: string; value: string }[];

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        Changes requested
      </p>
      <dl className="mt-2 space-y-1.5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-0.5">
            <dt className="text-xs text-gray-400">{r.label}</dt>
            <dd className="text-gray-700">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}