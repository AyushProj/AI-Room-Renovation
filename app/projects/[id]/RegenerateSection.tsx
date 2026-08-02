"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QuestionFlow from "@/app/components/QuestionFlow";
import type { RoomAnalysis, AnswersMap, Question } from "@/lib/types";

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

const COMMENTS_QUESTION: Question = {
  id: "additional_comments",
  question: "Anything else you'd like to mention?",
  type: "text",
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
      setQuestions([INTENSITY_QUESTION, ...data, COMMENTS_QUESTION]);
      setState("answering");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Something went wrong.");
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
        className="w-full rounded-md bg-brass px-5 py-3 text-sm font-medium text-white transition hover:bg-brass-dark"
      >
        Make more changes
      </button>
    );
  }

  if (state === "loading_questions") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-line bg-paper-raised py-10 text-sm text-ink-muted">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brass" />
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
      <div className="flex items-center justify-center gap-2 rounded-lg border border-line bg-paper-raised py-10 text-sm text-ink-muted">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brass" />
        Generating your next version... this can take up to a minute
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-clay/30 bg-clay/5 p-6 text-center">
      <p className="text-sm text-clay-dark">{error}</p>
      <button
        onClick={startNewVersion}
        className="mt-3 text-sm font-medium text-ink underline transition hover:text-brass-dark"
      >
        Try again
      </button>
    </div>
  );
}