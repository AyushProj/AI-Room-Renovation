"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ImageUploader from "./ImageUploader";
import QuestionFlow from "./QuestionFlow";
import type { RoomAnalysis, Question, AnswersMap } from "@/lib/types";

type Step =
  | "upload"
  | "analyzing"
  | "loading_questions"
  | "answering"
  | "complete"
  | "error";

export default function RoomAnalysisFlow({ userId }: { userId: string }) {
  const [step, setStep] = useState<Step>("upload");
  const [analysis, setAnalysis] = useState<RoomAnalysis | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<AnswersMap | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUploadComplete(path: string) {
    setStep("analyzing");
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
      await fetchQuestions(data);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Something went wrong analyzing the room."
      );
      setStep("error");
    }
  }

  async function fetchQuestions(roomAnalysis: RoomAnalysis) {
    setStep("loading_questions");
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis: roomAnalysis }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Could not generate questions");
      }

      const data: Question[] = await res.json();
      setQuestions(data);
      setStep("answering");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Something went wrong generating questions."
      );
      setStep("error");
    }
  }

  function handleQuestionsComplete(finalAnswers: AnswersMap) {
    setAnswers(finalAnswers);
    setStep("complete");
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {step === "upload" && (
        <ImageUploader userId={userId} onUploadComplete={handleUploadComplete} />
      )}

      <AnimatePresence mode="wait">
        {(step === "analyzing" || step === "loading_questions") && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-sm text-gray-500"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
            {step === "analyzing"
              ? "Scanning your room..."
              : "Putting together a few questions..."}
          </motion.div>
        )}

        {step === "error" && (
          <motion.p
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-red-600"
            role="alert"
          >
            {error}
          </motion.p>
        )}

        {step === "answering" && questions.length > 0 && (
          <motion.div
            key="questions"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
          >
            {analysis && <AnalysisSummary analysis={analysis} compact />}
            <div className="mt-6 flex justify-center">
              <QuestionFlow
                questions={questions}
                onComplete={handleQuestionsComplete}
              />
            </div>
          </motion.div>
        )}

        {step === "complete" && analysis && answers && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg space-y-4"
          >
            <AnalysisSummary analysis={analysis} />
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-left">
              <h2 className="text-sm font-semibold text-gray-900">
                Your preferences
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                {questions.map((q) => {
                  const value = answers[q.id];
                  if (!value || (Array.isArray(value) && value.length === 0)) {
                    return null;
                  }
                  return (
                    <Row
                      key={q.id}
                      label={q.question}
                      value={Array.isArray(value) ? value.join(", ") : value}
                    />
                  );
                })}
              </dl>
            </div>
            <p className="text-center text-sm text-gray-400">
              Image generation from these preferences is built in the next phase.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AnalysisSummary({
  analysis,
  compact = false,
}: {
  analysis: RoomAnalysis;
  compact?: boolean;
}) {
  return (
    <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 text-left">
      <h2 className="text-sm font-semibold text-gray-900">
        Here&apos;s what I see
      </h2>
      <dl className="mt-4 space-y-3 text-sm">
        <Row label="Room type" value={analysis.roomType} />
        {!compact && (
          <Row
            label="Existing furniture"
            value={analysis.existingFurniture.join(", ")}
          />
        )}
        <Row label="Style" value={analysis.style} />
        {!compact && (
          <>
            <Row label="Lighting" value={analysis.lighting} />
            <Row label="Condition" value={analysis.condition} />
            <Row
              label="Dominant colors"
              value={analysis.dominantColors.join(", ")}
            />
            {analysis.notes && <Row label="Notes" value={analysis.notes} />}
          </>
        )}
      </dl>
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
