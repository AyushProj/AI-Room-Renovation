"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-paper-raised p-8">
        <h1 className="font-display text-xl font-semibold text-ink">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Sign in to save and revisit your room designs.
        </p>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-line bg-paper-raised px-4 py-2.5 text-sm font-medium text-ink transition hover:border-ink-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Redirecting..." : "Continue with Google"}
        </button>

        {error && (
          <p className="mt-4 text-sm text-clay-dark" role="alert">
            Something went wrong: {error}
          </p>
        )}
      </div>
    </main>
  );
}