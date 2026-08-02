import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import RoomAnalysisFlow from "./components/RoomAnalysisFlow";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16 text-center sm:py-20">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
        Renovation<span className="text-brass">.</span>AI
      </h1>
      <p className="mt-3 max-w-md text-ink-muted">
        Upload a photo of your room and get AI-generated renovation ideas —
        same structure, new decor.
      </p>

      <div className="mt-10 flex w-full flex-col items-center">
        {user ? (
          <RoomAnalysisFlow userId={user.id} />
        ) : (
          <div className="rounded-lg border border-line bg-paper-raised px-8 py-10">
            <p className="text-sm text-ink-muted">
              Sign in to upload a photo and start a design.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-block rounded-md bg-brass px-4 py-2 text-sm font-medium text-white transition hover:bg-brass-dark"
            >
              Sign in
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}