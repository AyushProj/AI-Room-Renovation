"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import BeforeAfterSlider from "./BeforeAfterSlider";
import ProductHotspots from "./ProductHotspots";
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
    const interval = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, GENERATION_MESSAGES.length - 1));
    }, 6000);
    return () => clearInterval(interval);
  }, [state]);

  async function handleGenerate() {
    setState("generating");
    setMessageIndex(0);
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

  const errorMentionsSettings = error?.toLowerCase().includes("settings");

  return (
    <div className="w-full max-w-lg">
      {state === "ready" && (
        <button
          onClick={handleGenerate}
          className="w-full rounded-md bg-brass px-5 py-3 text-sm font-medium text-white transition hover:bg-brass-dark active:scale-[0.99]"
        >
          Generate My Design
        </button>
      )}

      {state === "generating" && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-line bg-paper-raised py-12 text-center">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brass opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-brass-dark" />
          </span>
          <motion.p
            key={messageIndex}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-ink-muted"
          >
            {GENERATION_MESSAGES[messageIndex]}
          </motion.p>
          <p className="font-mono text-xs text-ink-muted">
            This can take up to a minute
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="rounded-lg border border-clay/30 bg-clay/5 p-6 text-center">
          <p className="text-sm text-clay-dark">{error}</p>
          <div className="mt-3 flex items-center justify-center gap-4">
            <button
              onClick={handleGenerate}
              className="text-sm font-medium text-ink transition hover:text-brass-dark"
            >
              Try again
            </button>
            {errorMentionsSettings && (
              <Link
                href="/settings"
                className="text-sm font-medium text-ink underline transition hover:text-brass-dark"
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
          className="space-y-3"
        >
          <BeforeAfterSlider
            beforeUrl={originalImageUrl}
            afterUrl={generatedUrl}
          />

          <div className="flex items-center justify-center gap-4 text-center">
            <button
              onClick={handleGenerate}
              className="text-sm font-medium text-ink-muted transition hover:text-ink"
            >
              Generate another version
            </button>
            {projectId && (
              <Link
                href={`/projects/${projectId}`}
                className="text-sm font-medium text-brass-dark underline transition hover:text-brass"
              >
                View full history
              </Link>
            )}
          </div>
        </motion.div>
      )}

      {state === "done" && generatedUrl && (
        <div className="mt-4">
          <ProductHotspots imageUrl={generatedUrl} />
        </div>
      )}
    </div>
  );
}
