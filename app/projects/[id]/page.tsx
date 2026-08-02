import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RoomAnalysis, Question } from "@/lib/types";
import RegenerateSection from "./RegenerateSection";
import ProductHotspots from "@/app/components/ProductHotspots";
import CornerFrame from "@/app/components/CornerFrame";

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
        <p className="rounded-lg border border-clay/30 bg-clay/5 p-4 text-sm text-clay-dark">
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

  const analysis: RoomAnalysis = {
    roomType: typedProject.room_type ?? "room",
    style: typedProject.style ?? "",
    existingFurniture: typedProject.existing_furniture ?? [],
    lighting: typedProject.lighting ?? "",
    condition: typedProject.condition ?? "",
    dominantColors: typedProject.dominant_colors ?? [],
    notes: typedProject.notes ?? "",
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <Link
          href="/projects"
          className="text-sm text-ink-muted transition hover:text-ink"
        >
          ← My Projects
        </Link>
        <h1 className="font-mono text-xs uppercase tracking-wide text-ink-muted">
          {typedProject.room_type ?? "Room"} · {typedProject.style ?? ""}
        </h1>
      </div>

      <div className="space-y-6">
        <TimelineCard label="Original photo">
          {originalSigned?.signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={originalSigned.signedUrl}
              alt="Original room"
              className="w-full object-cover"
            />
          ) : (
            <div className="flex h-48 items-center justify-center font-mono text-xs text-ink-muted">
              Image link expired
            </div>
          )}
        </TimelineCard>

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
                <div className="flex h-48 items-center justify-center font-mono text-xs text-ink-muted">
                  Image link expired
                </div>
              )}
            </TimelineCard>
            {v.url && <ProductHotspots imageUrl={v.url} />}
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
    <div>
      <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      <CornerFrame className="overflow-hidden rounded-lg border border-line bg-paper-raised">
        {children}
      </CornerFrame>
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
    <div className="rounded-lg border border-line bg-paper p-4">
      <p className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
        Changes requested
      </p>
      <dl className="mt-2 space-y-1.5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-0.5">
            <dt className="font-mono text-[11px] text-ink-muted">
              {r.label}
            </dt>
            <dd className="text-ink">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}