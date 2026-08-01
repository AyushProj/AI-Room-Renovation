import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";


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
        <p className="text-sm text-red-600">
          Could not load your projects: {error.message}
        </p>
      </div>
    );
  }

  const projects = (rows ?? []) as ProjectRow[];

  const withThumbnails = await Promise.all(
    projects.map(async (p) => {
      // Show the most recent generated version as the thumbnail; fall
      // back to the original photo if nothing's generated yet.
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
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">My Projects</h1>
        <Link
          href="/"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          New renovation
        </Link>
      </div>

      {withThumbnails.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <p className="text-sm text-gray-500">
            No projects yet — generate your first design to see it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {withThumbnails.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="block overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:shadow-sm"
            >
              {p.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.thumbnailUrl}
                  alt={`${p.room_type ?? "Room"} project`}
                  className="h-48 w-full object-cover"
                />
              ) : (
                <div className="flex h-48 w-full items-center justify-center bg-gray-100 text-xs text-gray-400">
                  Image link expired
                </div>
              )}
              <div className="p-4">
                <p className="text-sm font-medium text-gray-900">
                  {p.room_type ?? "Room"}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {p.style ? `${p.style} · ` : ""}
                  {new Date(p.created_at).toLocaleDateString()}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}