import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";

export default async function NavBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <nav className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
      <Link href="/" className="text-sm font-semibold text-gray-900">
        Room Renovation AI
      </Link>

      <div className="flex items-center gap-4">
        {user ? (
          <>
            <Link
              href="/projects"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              My Projects
            </Link>
            <span className="text-sm text-gray-500">{user.email}</span>
            <SignOutButton />
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
