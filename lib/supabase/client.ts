import { createBrowserClient } from "@supabase/ssr";

// Use this in Client Components ("use client" files) — buttons, forms, etc.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
