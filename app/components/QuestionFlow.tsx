"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Question, Answer, AnswersMap } from "@/lib/types";

interface QuestionFlowProps {
  questions: Question[];
  onComplete: (answers: AnswersMap) => void;
}

const OTHER_OPTION = "Other (please specify)";

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
  const options = current.options ?? [];

  // Custom "Other" entry for multi_select: whichever selected value isn't
  // one of the preset options is treated as the freeform one, so at most
  // one custom entry is supported per multi_select question — a
  // reasonable simplification since there's only one text box to type it.
  const customMultiValue = Array.isArray(currentAnswer)
    ? currentAnswer.find((v) => !options.includes(v))
    : undefined;
  const isMultiOtherSelected = customMultiValue !== undefined;

  // For single_select: any answer that isn't one of the preset options
  // is a custom typed value — including "" while the user is mid-typing.
  const isSingleOtherSelected =
    current.type === "single_select" &&
    typeof currentAnswer === "string" &&
    !options.includes(currentAnswer);

  const canAdvance =
    current.type === "text"
      ? true // free text is optional
      : current.type === "multi_select"
      ? Array.isArray(currentAnswer) &&
        currentAnswer.filter((v) => v !== "").length > 0
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

  function toggleMultiOther() {
    const existing = Array.isArray(currentAnswer) ? currentAnswer : [];
    if (isMultiOtherSelected) {
      setAnswer(existing.filter((v) => options.includes(v)));
    } else {
      setAnswer([...existing, ""]);
    }
  }

  function setMultiOtherText(text: string) {
    const existing = Array.isArray(currentAnswer) ? currentAnswer : [];
    const withoutCustom = existing.filter((v) => options.includes(v));
    setAnswer([...withoutCustom, text]);
  }

  function goNext() {
    if (current.type === "text" && textDraft.trim()) {
      setAnswer(textDraft.trim());
    }
    setTextDraft("");

    if (isLast) {
      let finalAnswers =
        current.type === "text" && textDraft.trim()
          ? { ...answers, [current.id]: textDraft.trim() }
          : answers;

      // Strip empty "other" placeholders from any multi_select answers
      // before handing off — an untouched Other toggle shouldn't leave
      // a stray blank string in the final answer set.
      finalAnswers = Object.fromEntries(
        Object.entries(finalAnswers).map(([id, value]) =>
          Array.isArray(value)
            ? [id, value.filter((v) => v !== "")]
            : [id, value]
        )
      ) as AnswersMap;

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
      <div className="mb-6 flex items-center gap-1.5">
        {questions.map((q, i) => (
          <div
            key={q.id}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= index ? "bg-brass" : "bg-line"
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
          className="rounded-lg border border-line bg-paper-raised p-5 sm:p-6"
        >
          <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">
            {String(index + 1).padStart(2, "0")} / {String(questions.length).padStart(2, "0")}
          </p>
          <h2 className="mt-2 font-display text-lg font-semibold text-ink">
            {current.question}
          </h2>

          <div className="mt-5">
            {current.type === "single_select" && (
              <div className="flex flex-wrap gap-2">
                {[...options, OTHER_OPTION].map((opt) => {
                  const selected =
                    opt === OTHER_OPTION
                      ? isSingleOtherSelected
                      : currentAnswer === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() =>
                        opt === OTHER_OPTION ? setAnswer("") : setAnswer(opt)
                      }
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                        selected
                          ? "border-brass bg-brass text-white"
                          : "border-line text-ink-muted hover:border-ink-muted hover:text-ink"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
                {isSingleOtherSelected && (
                  <input
                    type="text"
                    autoFocus
                    value={typeof currentAnswer === "string" ? currentAnswer : ""}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type your answer"
                    className="mt-1 w-full rounded-md border border-line p-2.5 text-sm text-ink outline-none focus:border-brass"
                  />
                )}
              </div>
            )}

            {current.type === "multi_select" && (
              <div className="flex flex-wrap gap-2">
                {options.map((opt) => {
                  const selected =
                    Array.isArray(currentAnswer) &&
                    currentAnswer.includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => toggleMultiOption(opt)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                        selected
                          ? "border-brass bg-brass text-white"
                          : "border-line text-ink-muted hover:border-ink-muted hover:text-ink"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
                <button
                  onClick={toggleMultiOther}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    isMultiOtherSelected
                      ? "border-brass bg-brass text-white"
                      : "border-line text-ink-muted hover:border-ink-muted hover:text-ink"
                  }`}
                >
                  {OTHER_OPTION}
                </button>
                {isMultiOtherSelected && (
                  <input
                    type="text"
                    autoFocus
                    value={customMultiValue ?? ""}
                    onChange={(e) => setMultiOtherText(e.target.value)}
                    placeholder="Type your answer"
                    className="mt-1 w-full rounded-md border border-line p-2.5 text-sm text-ink outline-none focus:border-brass"
                  />
                )}
              </div>
            )}

            {current.type === "text" && (
              <textarea
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                placeholder="Optional — anything else you want to mention"
                rows={3}
                className="w-full rounded-md border border-line p-3 text-sm text-ink outline-none focus:border-brass"
              />
            )}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={goBack}
              disabled={index === 0}
              className="text-sm font-medium text-ink-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-0"
            >
              Back
            </button>
            <button
              onClick={goNext}
              disabled={!canAdvance}
              className="rounded-md bg-ink px-5 py-2 text-sm font-medium text-paper transition hover:bg-brass-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLast ? "Finish" : "Next"}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}