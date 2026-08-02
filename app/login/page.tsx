"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ErrorKind = "linking_disabled" | "already_linked" | "generic";

export default function LoginPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);

  // Supabase reports OAuth/linking errors in the URL HASH fragment
  // (#error=...), not the query string — the fragment never reaches the
  // server, so /auth/callback can't forward it as a query param. This
  // has to be read client-side, and takes priority over any ?error=...
  // the server route added as a generic fallback.
  useEffect(() => {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const hashErrorCode = hashParams.get("error_code");
    const hashDescription = hashParams.get("error_description");

    if (hashErrorCode) {
      applyError(hashErrorCode, hashDescription);
      // Clean the fragment out of the address bar so refreshing doesn't
      // keep re-showing a stale error.
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    const code = searchParams.get("error_code");
    const description = searchParams.get("error_description");
    const generic = searchParams.get("error");
    if (code) {
      applyError(code, description);
    } else if (generic) {
      applyError(generic, description);
    }
  }, [searchParams]);

  function applyError(code: string, description: string | null) {
    if (code === "identity_already_exists") {
      setErrorKind("already_linked");
      setError(
        description ?? "That Google account is already linked elsewhere."
      );
    } else if (code === "manual_linking_disabled") {
      setErrorKind("linking_disabled");
      setError(description ?? "Manual linking is disabled.");
    } else {
      setErrorKind("generic");
      setError(description ?? "Something went wrong signing you in.");
    }
  }

  async function signInFresh() {
    setLoading(true);
    setError(null);
    setErrorKind(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setError(error.message);
      setErrorKind("generic");
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    setErrorKind(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // If they're currently on an anonymous session, link Google to it
    // in place so their existing projects carry over — signInWithOAuth
    // here would instead create a brand new, separate account.
    const { error } = user?.is_anonymous
      ? await supabase.auth.linkIdentity({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        })
      : await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        });

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("manual linking is disabled")) {
        setErrorKind("linking_disabled");
      } else if (
        message.includes("already been linked") ||
        message.includes("already exists") ||
        message.includes("already registered")
      ) {
        setErrorKind("already_linked");
      } else {
        setErrorKind("generic");
      }
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-16">
      <div className="w-full max-w-sm rounded-md border border-line bg-surface p-8">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">
          Sign in
        </p>
        <h1 className="mt-2 font-display text-xl font-bold text-ink">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-muted">
          Sign in to save and revisit your room designs.
        </p>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Redirecting..." : "Continue with Google"}
        </button>

        {errorKind === "already_linked" && (
          <div className="mt-4 rounded-md border border-line bg-canvas p-3">
            <p className="text-sm text-ink">
              That Google account is already linked to a different sign-in.
              Continuing will sign you into that existing account instead —
              anything you made just now as a guest won&apos;t carry over.
            </p>
            <button
              onClick={signInFresh}
              disabled={loading}
              className="mt-3 text-sm font-medium text-accent underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continue anyway
            </button>
          </div>
        )}

        {errorKind === "linking_disabled" && (
          <p className="mt-4 text-sm text-danger">
            Sign-in isn&apos;t fully set up yet on this project (manual
            account linking is off). This is a configuration issue, not
            something you did — try again shortly.
          </p>
        )}

        {errorKind === "generic" && error && (
          <p className="mt-4 text-sm text-danger">
            Something went wrong: {error}
          </p>
        )}
      </div>
    </main>
  );
}