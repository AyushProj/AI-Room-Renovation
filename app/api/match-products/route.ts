import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ExtractedItem, MatchedProduct } from "@/lib/types";

const TARGET_RETAILERS = ["ikea", "walmart", "home depot", "homedepot"];
const CACHE_MAX_AGE_DAYS = 30;

export async function POST(request: Request) {
  try {
    const { items } = (await request.json()) as { items: ExtractedItem[] };
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing items" }, { status: 400 });
    }

    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "SERPAPI_KEY is not set on the server." },
        { status: 500 }
      );
    }

    const supabase = await createClient();

    const results = await Promise.all(
      items.map(async (item) => {
        const cacheKey = item.label.trim().toLowerCase();

        const { data: cached } = await supabase
          .from("product_match_cache")
          .select("products, created_at")
          .eq("label_key", cacheKey)
          .maybeSingle();

        let products: MatchedProduct[];

        if (cached && withinCacheWindow(cached.created_at as string)) {
          products = cached.products as MatchedProduct[];
        } else {
          products = await searchSerpApi(item.label, apiKey);
          await supabase.from("product_match_cache").upsert({
            label_key: cacheKey,
            products,
          });
        }

        return { ...item, products };
      })
    );

    return NextResponse.json(results);
  } catch (err) {
    console.error("Match products route error:", err);
    return NextResponse.json(
      { error: "Could not match products for these items." },
      { status: 500 }
    );
  }
}

function withinCacheWindow(createdAt: string): boolean {
  const ageDays =
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return ageDays < CACHE_MAX_AGE_DAYS;
}

interface RawShoppingResult {
  title?: string;
  price?: string;
  thumbnail?: string;
  product_link?: string;
  link?: string;
  source?: string;
}

async function searchSerpApi(
  label: string,
  apiKey: string
): Promise<MatchedProduct[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", label);
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`SerpAPI request failed: ${res.status}`);
  }
  const data = await res.json();

  const raw: RawShoppingResult[] = data?.shopping_results ?? [];

  const mapped: MatchedProduct[] = raw
    .filter((r) => r.title && (r.product_link || r.link))
    .map((r) => ({
      title: r.title as string,
      price: r.price ?? "",
      thumbnail: r.thumbnail ?? "",
      link: (r.product_link ?? r.link) as string,
      retailer: r.source ?? "",
    }));

  const prioritized = mapped.filter((m) =>
    TARGET_RETAILERS.some((t) => m.retailer.toLowerCase().includes(t))
  );
  const rest = mapped.filter((m) => !prioritized.includes(m));

  return [...prioritized, ...rest].slice(0, 3);
}
