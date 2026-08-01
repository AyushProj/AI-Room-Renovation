"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import BeforeAfterSlider from "./BeforeAfterSlider";
import type { RoomAnalysis, AnswersMap, Question } from "@/lib/types";

interface DesignGeneratorProps {
  originalImagePath: string;
  originalImageUrl: string;
  analysis: RoomAnalysis;
  answers: AnswersMap;
  questions: Question[];
  projectId?: string | null;
}

type GenState = "ready" | "generating" | "done" | "error";

// Rotates through these while the request is in flight so a ~20-40s wait
// never reads as a dead pause. Not tied to real progress — just keeps
// the wait feeling active.
const GENERATION_MESSAGES = [
  "Reading your room's layout...",
  "Sketching new furniture placement...",
  "Applying your style preferences...",
  "Rendering the final photorealistic pass...",
];

export default function DesignGenerator({
  originalImagePath,
  originalImageUrl,
  analysis,
  answers,
  questions,
  projectId,
}: DesignGeneratorProps) {
  const [state, setState] = useState<GenState>("ready");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (state !== "generating") return;
    setMessageIndex(0);
    const interval = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, GENERATION_MESSAGES.length - 1));
    }, 6000);
    return () => clearInterval(interval);
  }, [state]);

  async function handleGenerate() {
    setState("generating");
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: originalImagePath,
          originalImageUrl,
          analysis,
          answers,
          questions,
          projectId,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Generation failed");
      }

      const data: { url: string } = await res.json();
      setGeneratedUrl(data.url);
      setState("done");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong generating the design."
      );
      setState("error");
    }
  }

  // Errors that mention Settings get an actual link there, since that's
  // the actionable next step for a quota/auth failure.
  const errorMentionsSettings = error?.toLowerCase().includes("settings");

  return (
    <div className="w-full max-w-lg">
      {state === "ready" && (
        <button
          onClick={handleGenerate}
          className="w-full rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 active:scale-[0.99]"
        >
          Generate My Design
        </button>
      )}

      {state === "generating" && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-12 text-center">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gray-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-gray-600" />
          </span>
          <motion.p
            key={messageIndex}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-gray-600"
          >
            {GENERATION_MESSAGES[messageIndex]}
          </motion.p>
          <p className="text-xs text-gray-400">This can take up to a minute</p>
        </div>
      )}

      {state === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <div className="mt-3 flex items-center justify-center gap-4">
            <button
              onClick={handleGenerate}
              className="text-sm font-medium text-gray-700 underline"
            >
              Try again
            </button>
            {errorMentionsSettings && (
              <Link
                href="/settings"
                className="text-sm font-medium text-gray-900 underline"
              >
                Go to Settings
              </Link>
            )}
          </div>
        </div>
      )}

      {state === "done" && generatedUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="overflow-hidden rounded-xl border border-gray-200"
        >
          <BeforeAfterSlider
            beforeUrl={originalImageUrl}
            afterUrl={generatedUrl}
          />

          <div className="flex items-center justify-center gap-4 border-t border-gray-100 p-4 text-center">
            <button
              onClick={handleGenerate}
              className="text-sm font-medium text-gray-500 transition hover:text-gray-900"
            >
              Generate another version
            </button>
            {projectId && (
              <Link
                href={`/projects/${projectId}`}
                className="text-sm font-medium text-gray-900 underline transition hover:text-gray-700"
              >
                View full history
              </Link>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}