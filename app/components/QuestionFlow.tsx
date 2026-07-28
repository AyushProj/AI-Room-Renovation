"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Question, Answer, AnswersMap } from "@/lib/types";

interface QuestionFlowProps {
  questions: Question[];
  onComplete: (answers: AnswersMap) => void;
}

export default function QuestionFlow({
  questions,
  onComplete,
}: QuestionFlowProps) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [textDraft, setTextDraft] = useState("");

  const current = questions[index];
  const isLast = index === questions.length - 1;
  const currentAnswer = answers[current.id];
  const canAdvance =
    current.type === "text"
      ? true // free text is optional
      : current.type === "multi_select"
      ? Array.isArray(currentAnswer) && currentAnswer.length > 0
      : typeof currentAnswer === "string" && currentAnswer.length > 0;

  function setAnswer(value: Answer) {
    setAnswers((prev) => ({ ...prev, [current.id]: value }));
  }

  function toggleMultiOption(option: string) {
    const existing = Array.isArray(currentAnswer) ? currentAnswer : [];
    const next = existing.includes(option)
      ? existing.filter((o) => o !== option)
      : [...existing, option];
    setAnswer(next);
  }

  function goNext() {
    if (current.type === "text" && textDraft.trim()) {
      setAnswer(textDraft.trim());
    }
    setTextDraft("");

    if (isLast) {
      const finalAnswers =
        current.type === "text" && textDraft.trim()
          ? { ...answers, [current.id]: textDraft.trim() }
          : answers;
      onComplete(finalAnswers);
    } else {
      setIndex((i) => i + 1);
    }
  }

  function goBack() {
    if (index > 0) setIndex((i) => i - 1);
  }

  return (
    <div className="w-full max-w-lg">
      {/* Progress */}
      <div className="mb-6 flex items-center gap-2">
        {questions.map((q, i) => (
          <div
            key={q.id}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= index ? "bg-gray-900" : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.2 }}
          className="rounded-xl border border-gray-200 bg-white p-6"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Question {index + 1} of {questions.length}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-gray-900">
            {current.question}
          </h2>

          <div className="mt-5">
            {current.type === "single_select" && (
              <div className="flex flex-wrap gap-2">
                {current.options?.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setAnswer(opt)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      currentAnswer === opt
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-300 text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {current.type === "multi_select" && (
              <div className="flex flex-wrap gap-2">
                {current.options?.map((opt) => {
                  const selected =
                    Array.isArray(currentAnswer) &&
                    currentAnswer.includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => toggleMultiOption(opt)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                        selected
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-300 text-gray-700 hover:border-gray-400"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {current.type === "text" && (
              <textarea
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                placeholder="Optional — anything else you want to mention"
                rows={3}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 outline-none focus:border-gray-500"
              />
            )}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={goBack}
              disabled={index === 0}
              className="text-sm font-medium text-gray-400 transition hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-0"
            >
              Back
            </button>
            <button
              onClick={goNext}
              disabled={!canAdvance}
              className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLast ? "Finish" : "Next"}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
