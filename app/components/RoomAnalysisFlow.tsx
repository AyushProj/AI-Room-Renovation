"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ImageUploader from "./ImageUploader";
import type { RoomAnalysis } from "@/lib/types";

type AnalysisState = "idle" | "analyzing" | "done" | "error";

export default function RoomAnalysisFlow({ userId }: { userId: string }) {
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [analysis, setAnalysis] = useState<RoomAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUploadComplete(path: string) {
    setAnalysisState("analyzing");
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Analysis failed");
      }

      const data: RoomAnalysis = await res.json();
      setAnalysis(data);
      setAnalysisState("done");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Something went wrong analyzing the room."
      );
      setAnalysisState("error");
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <ImageUploader userId={userId} onUploadComplete={handleUploadComplete} />

      <AnimatePresence>
        {analysisState === "analyzing" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-sm text-gray-500"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
            Scanning your room...
          </motion.div>
        )}

        {analysisState === "error" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-red-600"
            role="alert"
          >
            {error}
          </motion.p>
        )}

        {analysisState === "done" && analysis && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 text-left"
          >
            <h2 className="text-sm font-semibold text-gray-900">
              Here&apos;s what I see
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Room type" value={analysis.roomType} />
              <Row
                label="Existing furniture"
                value={analysis.existingFurniture.join(", ")}
              />
              <Row label="Style" value={analysis.style} />
              <Row label="Lighting" value={analysis.lighting} />
              <Row label="Condition" value={analysis.condition} />
              <Row
                label="Dominant colors"
                value={analysis.dominantColors.join(", ")}
              />
              {analysis.notes && <Row label="Notes" value={analysis.notes} />}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </dt>
      <dd className="text-gray-700">{value}</dd>
    </div>
  );
}
