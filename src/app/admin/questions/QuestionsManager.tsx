"use client";

import { useState } from "react";
import type { ApplicationQuestion, ApplicationQuestionPreset, InterviewQuestion } from "@/lib/types";
import { ApplicationQuestionManager } from "../application-questions/ApplicationQuestionManager";
import { InterviewQuestionManager } from "../interview-questions/InterviewQuestionManager";

type QuestionKind = "application" | "interview";

export function QuestionsManager({
  applicationQuestions,
  interviewQuestions,
  presets,
}: {
  applicationQuestions: ApplicationQuestion[];
  interviewQuestions: InterviewQuestion[];
  presets: ApplicationQuestionPreset[];
}) {
  const [kind, setKind] = useState<QuestionKind>("application");

  return (
    <div>
      <div className="mb-6 flex gap-1 border-b border-gray-200" role="tablist" aria-label="질문 종류">
        {([
          ["application", "지원 질문"],
          ["interview", "면접 질문"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={kind === value}
            onClick={() => setKind(value)}
            className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${kind === value ? "bg-primary-soft text-primary" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {kind === "application" ? (
        <ApplicationQuestionManager questions={applicationQuestions} presets={presets} />
      ) : (
        <InterviewQuestionManager questions={interviewQuestions} />
      )}
    </div>
  );
}
