import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import RoomAnalysisFlow from "./components/RoomAnalysisFlow";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-20 text-center">
      <h1 className="text-3xl font-semibold text-gray-900">
        Room Renovation AI
      </h1>
      <p className="mt-3 max-w-md text-gray-500">
        Upload a photo of your room and get AI-generated renovation ideas.
      </p>

      <div className="mt-10 flex w-full flex-col items-center">
        {user ? (
          <RoomAnalysisFlow userId={user.id} />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-8 py-10">
            <p className="text-sm text-gray-600">
              Sign in to upload a photo and start a design.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
            >
              Sign in
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
