import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";

export default async function NavBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <nav className="flex items-center justify-between border-b border-line bg-paper-raised px-4 py-3 sm:px-6 sm:py-4">
      <Link
        href="/"
        className="font-display text-sm font-semibold tracking-tight text-ink sm:text-base"
      >
        Renovation<span className="text-brass">.</span>AI
      </Link>

      <div className="flex items-center gap-2 sm:gap-4">
        {user ? (
          <>
            <Link
              href="/projects"
              className="hidden text-sm text-ink-muted transition hover:text-ink sm:inline"
            >
              My Projects
            </Link>
            <Link
              href="/settings"
              className="text-sm text-ink-muted transition hover:text-ink"
            >
              Settings
            </Link>
            <span className="hidden max-w-[10rem] truncate font-mono text-xs text-ink-muted md:inline">
              {user.email}
            </span>
            <SignOutButton />
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-md bg-ink px-4 py-1.5 text-sm font-medium text-paper transition hover:bg-brass-dark"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}