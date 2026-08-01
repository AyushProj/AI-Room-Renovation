"use client";

import { useEffect, useState } from "react";
import type { ItemWithMatches } from "@/lib/types";

type Status = "loading" | "done" | "error" | "empty";

export default function ProductHotspots({ imageUrl }: { imageUrl: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [items, setItems] = useState<ItemWithMatches[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setStatus("loading");
      setActiveIndex(null);

      try {
        const extractRes = await fetch("/api/extract-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl }),
        });
        if (!extractRes.ok) throw new Error("extract failed");
        const extracted = await extractRes.json();

        if (!Array.isArray(extracted) || extracted.length === 0) {
          if (!cancelled) setStatus("empty");
          return;
        }

        const matchRes = await fetch("/api/match-products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: extracted }),
        });
        if (!matchRes.ok) throw new Error("match failed");
        const withMatches: ItemWithMatches[] = await matchRes.json();

        if (!cancelled) {
          setItems(withMatches);
          setStatus(withMatches.length > 0 ? "done" : "empty");
        }
      } catch (err) {
        console.error("ProductHotspots failed:", err);
        if (!cancelled) setStatus("error");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
        Finding shoppable items in your design...
      </div>
    );
  }

  // Fails quietly — this is a bonus feature layered on top of a
  // successful generation, so a failure here shouldn't read as if the
  // whole result is broken.
  if (status === "error" || status === "empty") {
    return null;
  }

  const active = activeIndex !== null ? items[activeIndex] : null;

  return (
    <div className="w-full max-w-lg">
      <p className="mb-2 text-sm font-medium text-gray-900">
        Shop items in this design
      </p>

      <div className="relative overflow-hidden rounded-xl border border-gray-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Renovated room with shoppable items"
          className="block w-full"
        />
        {items.map((item, i) => (
          <button
            key={`${item.label}-${i}`}
            onClick={() => setActiveIndex(i === activeIndex ? null : i)}
            style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }}
            className={`absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-xs font-semibold shadow transition ${
              i === activeIndex
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-900 bg-white text-gray-900 hover:bg-gray-900 hover:text-white"
            }`}
            aria-label={`Show products for ${item.label}`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {active && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-900">{active.label}</p>
          {active.products.length === 0 ? (
            <p className="mt-2 text-sm text-gray-400">
              No matching products found.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {active.products.map((p, pi) => (
                <a
                  key={pi}
                  href={p.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-lg border border-gray-200 transition hover:shadow-sm"
                >
                  {p.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.thumbnail}
                      alt={p.title}
                      className="h-24 w-full object-cover"
                    />
                  ) : (
                    <div className="h-24 w-full bg-gray-100" />
                  )}
                  <div className="p-2">
                    <p className="line-clamp-2 text-xs text-gray-700">
                      {p.title}
                    </p>
                    <p className="mt-1 text-xs font-medium text-gray-900">
                      {p.price}
                    </p>
                    {p.retailer && (
                      <p className="text-xs text-gray-400">{p.retailer}</p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
