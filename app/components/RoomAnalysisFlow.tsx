"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ImageUploader from "./ImageUploader";
import QuestionFlow from "./QuestionFlow";
import DesignGenerator from "./DesignGenerator";
import type { RoomAnalysis, Question, AnswersMap } from "@/lib/types";

type Step =
  | "upload"
  | "analyzing"
  | "loading_questions"
  | "answering"
  | "complete"
  | "error";

const ANALYZING_MESSAGES = [
  "Reading the room's layout...",
  "Noting furniture and finishes...",
  "Checking light and color...",
];

const QUESTIONS_MESSAGES = [
  "Deciding what's worth asking...",
  "Tailoring questions to this room...",
];

export default function RoomAnalysisFlow({ userId }: { userId: string }) {
  const [step, setStep] = useState<Step>("upload");
  const [analysis, setAnalysis] = useState<RoomAnalysis | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<AnswersMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [originalImagePath, setOriginalImagePath] = useState<string | null>(
    null
  );
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(
    null
  );
  const [projectId, setProjectId] = useState<string | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (step !== "analyzing" && step !== "loading_questions") return;
    setMessageIndex(0);
    const messages =
      step === "analyzing" ? ANALYZING_MESSAGES : QUESTIONS_MESSAGES;
    const interval = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, messages.length - 1));
    }, 2500);
    return () => clearInterval(interval);
  }, [step]);

  async function handleUploadComplete(path: string, signedUrl: string) {
    setOriginalImagePath(path);
    setOriginalImageUrl(signedUrl);
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

      try {
        const projectRes = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, analysis: data }),
        });
        if (projectRes.ok) {
          const { projectId: newProjectId } = await projectRes.json();
          setProjectId(newProjectId);
        } else {
          console.error("Could not create project row");
        }
      } catch (projectErr) {
        console.error("Could not create project row:", projectErr);
      }

      await fetchQuestions(data);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't read this photo. Try a clearer, well-lit shot of the room."
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
      const intensityQuestion: Question = {
        id: "renovation_intensity",
        question: "How much do you want to change?",
        type: "single_select",
        options: [
          "Full refresh — swap everything (furniture, colors, decor)",
          "Moderate — new furniture, keep a few current pieces",
          "Light — mostly styling and accessories",
        ],
      };
      const commentsQuestion: Question = {
        id: "additional_comments",
        question: "Anything else you'd like to mention?",
        type: "text",
      };
      setQuestions([intensityQuestion, ...data, commentsQuestion]);
      setStep("answering");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't put together questions for this room. Try again."
      );
      setStep("error");
    }
  }

  function handleQuestionsComplete(finalAnswers: AnswersMap) {
    setAnswers(finalAnswers);
    setStep("complete");
  }

  return (
    <div className="flex w-full flex-col items-center gap-6 px-4 sm:px-0">
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
            className="flex flex-col items-center gap-2 py-6 text-center"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brass opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brass-dark" />
            </span>
            <motion.p
              key={messageIndex}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-ink-muted"
            >
              {(step === "analyzing" ? ANALYZING_MESSAGES : QUESTIONS_MESSAGES)[
                messageIndex
              ]}
            </motion.p>
          </motion.div>
        )}

        {step === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-lg rounded-lg border border-clay/30 bg-clay/5 p-4 text-center"
            role="alert"
          >
            <p className="text-sm text-clay-dark">{error}</p>
          </motion.div>
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
            <div className="rounded-lg border border-line bg-paper-raised p-5 text-left sm:p-6">
              <h2 className="font-display text-sm font-semibold text-ink">
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
            <p className="text-center text-sm text-ink-muted">
              Generate a photorealistic preview below.
            </p>
            {originalImagePath && originalImageUrl && (
              <div className="flex justify-center">
                <DesignGenerator
                  originalImagePath={originalImagePath}
                  originalImageUrl={originalImageUrl}
                  analysis={analysis}
                  answers={answers}
                  questions={questions}
                  projectId={projectId}
                />
              </div>
            )}
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
    <div className="w-full max-w-lg rounded-lg border border-line bg-paper-raised p-5 text-left sm:p-6">
      <h2 className="font-display text-sm font-semibold text-ink">
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
      <dt className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}