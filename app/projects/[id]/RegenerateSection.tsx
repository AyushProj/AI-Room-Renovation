"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QuestionFlow from "@/app/components/QuestionFlow";
import type { RoomAnalysis, AnswersMap, Question } from "@/lib/types";

// File location: app/projects/[id]/RegenerateSection.tsx
// Adjust the QuestionFlow import path above to match where that
// component actually lives in your project.

interface RegenerateSectionProps {
  projectId: string;
  originalImagePath: string;
  originalImageUrl: string;
  analysis: RoomAnalysis;
}

type State =
  | "idle"
  | "loading_questions"
  | "answering"
  | "generating"
  | "error";

const INTENSITY_QUESTION: Question = {
  id: "renovation_intensity",
  question: "How much do you want to change this time?",
  type: "single_select",
  options: [
    "Full refresh — swap everything (furniture, colors, decor)",
    "Moderate — new furniture, keep a few current pieces",
    "Light — mostly styling and accessories",
  ],
};

export default function RegenerateSection({
  projectId,
  originalImagePath,
  originalImageUrl,
  analysis,
}: RegenerateSectionProps) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function startNewVersion() {
    setState("loading_questions");
    setError(null);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Could not generate questions");
      }
      const data: Question[] = await res.json();
      setQuestions([INTENSITY_QUESTION, ...data]);
      setState("answering");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
      setState("error");
    }
  }

  async function handleAnswersComplete(answers: AnswersMap) {
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
      // Re-fetches the server component above with the new version
      // included, instead of managing a duplicate copy of the timeline
      // in client state.
      router.refresh();
      setState("idle");
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

  if (state === "idle") {
    return (
      <button
        onClick={startNewVersion}
        className="w-full rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
      >
        Make more changes
      </button>
    );
  }

  if (state === "loading_questions") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-10 text-sm text-gray-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
        Putting together a few questions...
      </div>
    );
  }

  if (state === "answering") {
    return (
      <QuestionFlow questions={questions} onComplete={handleAnswersComplete} />
    );
  }

  if (state === "generating") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-10 text-sm text-gray-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
        Generating your next version... this can take up to a minute
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm text-red-600">{error}</p>
      <button
        onClick={startNewVersion}
        className="mt-3 text-sm font-medium text-gray-700 underline"
      >
        Try again
      </button>
    </div>
  );
}