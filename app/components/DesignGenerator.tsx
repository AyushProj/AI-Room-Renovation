"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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
  const [view, setView] = useState<"before" | "after">("after");

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
      setView("after");
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

  return (
    <div className="w-full max-w-lg">
      {state === "ready" && (
        <button
          onClick={handleGenerate}
          className="w-full rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          Generate My Design
        </button>
      )}

      {state === "generating" && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-10 text-sm text-gray-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
          Generating your renovated room... this can take up to a minute
        </div>
      )}

      {state === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={handleGenerate}
            className="mt-3 text-sm font-medium text-gray-700 underline"
          >
            Try again
          </button>
        </div>
      )}

      {state === "done" && generatedUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="overflow-hidden rounded-xl border border-gray-200"
        >
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setView("before")}
              className={`flex-1 py-2 text-sm font-medium transition ${
                view === "before"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Before
            </button>
            <button
              onClick={() => setView("after")}
              className={`flex-1 py-2 text-sm font-medium transition ${
                view === "after"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              After
            </button>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={view === "before" ? originalImageUrl : generatedUrl}
            alt={view === "before" ? "Original room" : "Renovated room"}
            className="w-full object-cover"
          />

          <div className="flex items-center justify-center gap-4 p-4 text-center">
            <button
              onClick={handleGenerate}
              className="text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              Generate another version
            </button>
            {projectId && (
              <Link
                href={`/projects/${projectId}`}
                className="text-sm font-medium text-gray-900 underline hover:text-gray-700"
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