import { createClient } from "@/lib/supabase/server";

export interface ResolvedCloudflareCreds {
  accountId: string;
  apiToken: string;
  isUserOwned: boolean;
}

export interface ResolvedSerpApiKey {
  key: string;
  isUserOwned: boolean;
}

// Prefers the signed-in user's own saved key; falls back to the app's
// shared env-var key if the user hasn't set one.
export async function resolveCloudflareCreds(
  userId: string
): Promise<ResolvedCloudflareCreds | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_api_keys")
    .select("cloudflare_account_id, cloudflare_api_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (data?.cloudflare_account_id && data?.cloudflare_api_token) {
    return {
      accountId: data.cloudflare_account_id,
      apiToken: data.cloudflare_api_token,
      isUserOwned: true,
    };
  }

  const fallbackAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const fallbackApiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (fallbackAccountId && fallbackApiToken) {
    return {
      accountId: fallbackAccountId,
      apiToken: fallbackApiToken,
      isUserOwned: false,
    };
  }

  return null;
}

export async function resolveSerpApiKey(
  userId: string
): Promise<ResolvedSerpApiKey | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_api_keys")
    .select("serpapi_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (data?.serpapi_key) {
    return { key: data.serpapi_key, isUserOwned: true };
  }

  const fallback = process.env.SERPAPI_KEY;
  if (fallback) {
    return { key: fallback, isUserOwned: false };
  }

  return null;
}