import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex-1 px-6 py-10">
      <h1 className="text-2xl font-semibold text-gray-900">My Projects</h1>
      <p className="mt-2 text-sm text-gray-500">
        Signed in as {user.email}. Saved projects will show up here — built
        in Phase 8.
      </p>
    </main>
  );
}
