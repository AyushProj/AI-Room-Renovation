import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CornerFrame from "@/app/components/CornerFrame";

interface ProjectRow {
  id: string;
  original_path: string;
  room_type: string | null;
  style: string | null;
  created_at: string;
}

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: rows, error } = await supabase
    .from("projects")
    .select("id, original_path, room_type, style, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="rounded-lg border border-clay/30 bg-clay/5 p-4 text-sm text-clay-dark">
          Could not load your projects: {error.message}
        </p>
      </div>
    );
  }

  const projects = (rows ?? []) as ProjectRow[];

  const withThumbnails = await Promise.all(
    projects.map(async (p) => {
      const { data: latestVersion } = await supabase
        .from("generated_designs")
        .select("generated_path")
        .eq("project_id", p.id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const thumbPath = latestVersion?.generated_path ?? p.original_path;
      const thumbBucket = latestVersion?.generated_path
        ? "generated-images"
        : "room-images";

      const { data: signed } = await supabase.storage
        .from(thumbBucket)
        .createSignedUrl(thumbPath, 60 * 60);

      return { ...p, thumbnailUrl: signed?.signedUrl ?? null };
    })
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold text-ink">
          My Projects
        </h1>
        <Link
          href="/"
          className="rounded-md bg-brass px-4 py-2 text-sm font-medium text-white transition hover:bg-brass-dark"
        >
          New renovation
        </Link>
      </div>

      {withThumbnails.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line py-16 text-center">
          <p className="text-sm text-ink-muted">
            No projects yet. Generate your first design to see it here.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-medium text-brass-dark underline"
          >
            Start a renovation
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {withThumbnails.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="block">
              <CornerFrame className="overflow-hidden rounded-lg border border-line bg-paper-raised transition hover:border-ink-muted">
                {p.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.thumbnailUrl}
                    alt={`${p.room_type ?? "Room"} project`}
                    className="h-48 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-48 w-full items-center justify-center bg-paper font-mono text-xs text-ink-muted">
                    Image link expired
                  </div>
                )}
                <div className="p-4">
                  <p className="text-sm font-medium text-ink">
                    {p.room_type ?? "Room"}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-ink-muted">
                    {p.style ? `${p.style} · ` : ""}
                    {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
              </CornerFrame>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}