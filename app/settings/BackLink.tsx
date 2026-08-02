"use client";

import { useRouter } from "next/navigation";

export default function BackLink() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="mb-4 flex items-center gap-1 text-sm text-ink-muted transition hover:text-ink"
    >
      ← Back
    </button>
  );
}