"use client";

import { useEffect, useState } from "react";
import CornerFrame from "./CornerFrame";
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
      <div className="flex items-center gap-2 font-mono text-xs text-ink-muted">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brass" />
        Finding shoppable items...
      </div>
    );
  }

  if (status === "error" || status === "empty") {
    return (
      <p className="font-mono text-xs text-ink-muted">
        {status === "empty"
          ? "No individually shoppable items found in this design."
          : "Couldn't look up products for this design right now."}
      </p>
    );
  }

  const active = activeIndex !== null ? items[activeIndex] : null;

  return (
    <div className="w-full max-w-lg">
      <p className="mb-2 font-display text-sm font-medium text-ink">
        Shop items in this design
      </p>

      <CornerFrame className="overflow-hidden rounded-lg">
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
            className={`absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 font-mono text-xs font-semibold shadow transition ${
              i === activeIndex
                ? "border-brass-dark bg-brass text-white"
                : "border-brass bg-paper-raised text-brass-dark hover:bg-brass hover:text-white"
            }`}
            aria-label={`Show products for ${item.label}`}
          >
            {i + 1}
          </button>
        ))}
      </CornerFrame>

      {active && (
        <div className="mt-3 rounded-lg border border-line bg-paper-raised p-4">
          <p className="text-sm font-medium text-ink">{active.label}</p>
          {active.products.length === 0 ? (
            <p className="mt-2 font-mono text-xs text-ink-muted">
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
                  className="block overflow-hidden rounded-md border border-line transition hover:border-ink-muted hover:shadow-sm"
                >
                  {p.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.thumbnail}
                      alt={p.title}
                      className="h-24 w-full object-cover"
                    />
                  ) : (
                    <div className="h-24 w-full bg-paper" />
                  )}
                  <div className="p-2">
                    <p className="line-clamp-2 text-xs text-ink">
                      {p.title}
                    </p>
                    <p className="mt-1 font-mono text-xs font-medium text-ink">
                      {p.price}
                    </p>
                    {p.retailer && (
                      <p className="font-mono text-[11px] text-ink-muted">
                        {p.retailer}
                      </p>
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
