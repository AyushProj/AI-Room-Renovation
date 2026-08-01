import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function mask(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 6) return "••••••";
  return `${value.slice(0, 3)}••••${value.slice(-3)}`;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_api_keys")
    .select("cloudflare_account_id, cloudflare_api_token, serpapi_key")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    cloudflareAccountId: data?.cloudflare_account_id ?? null,
    cloudflareApiTokenMasked: mask(data?.cloudflare_api_token),
    hasCloudflareApiToken: !!data?.cloudflare_api_token,
    serpApiKeyMasked: mask(data?.serpapi_key),
    hasSerpApiKey: !!data?.serpapi_key,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const {
    cloudflareAccountId,
    cloudflareApiToken,
    serpApiKey,
    clearCloudflare,
    clearSerpApi,
  } = body as {
    cloudflareAccountId?: string;
    cloudflareApiToken?: string;
    serpApiKey?: string;
    clearCloudflare?: boolean;
    clearSerpApi?: boolean;
  };

  // Load the existing row so a blank field in the form doesn't wipe out
  // a previously saved key the user didn't mean to touch (e.g. saving a
  // new Account ID shouldn't clear an already-saved token).
  const { data: existing } = await supabase
    .from("user_api_keys")
    .select("cloudflare_account_id, cloudflare_api_token, serpapi_key")
    .eq("user_id", user.id)
    .maybeSingle();

  const nextRow = {
    user_id: user.id,
    cloudflare_account_id: clearCloudflare
      ? null
      : cloudflareAccountId?.trim() || existing?.cloudflare_account_id || null,
    cloudflare_api_token: clearCloudflare
      ? null
      : cloudflareApiToken?.trim() || existing?.cloudflare_api_token || null,
    serpapi_key: clearSerpApi
      ? null
      : serpApiKey?.trim() || existing?.serpapi_key || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("user_api_keys")
    .upsert(nextRow, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}