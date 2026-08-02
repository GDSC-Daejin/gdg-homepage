"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitSurveyResponse } from "@/actions/survey";
import { Button } from "@/components/Button";
import { Textarea } from "@/components/Textarea";
import { EVENTS, trackEvent } from "@/lib/analytics";
import type { SurveyQuestion } from "@/lib/types";

interface SurveyResponseFormProps {
  surveyId: string;
  questions: SurveyQuestion[];
  initialAnswers?: Record<string, number | string>;
}

const RATING_OPTIONS = [1, 2, 3, 4, 5];

export function SurveyResponseForm({
  surveyId,
  questions,
  initialAnswers,
}: SurveyResponseFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const isEdit = !!initialAnswers;

  function handleSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await submitSurveyResponse(surveyId, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      trackEvent(EVENTS.surveySubmit, { survey_id: surveyId });
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      {questions.map((q) => {
        const initial = initialAnswers?.[q.id];
        return (
          <div key={q.id} className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-700">{q.label}</span>
            {q.type === "rating" ? (
              <div className="flex gap-4">
                {RATING_OPTIONS.map((score) => (
                  <label
                    key={score}
                    className="flex items-center gap-1.5 text-sm text-gray-700"
                  >
                    <input
                      type="radio"
                      name={`answer_${q.id}`}
                      value={score}
                      defaultChecked={Number(initial) === score}
                      required
                    />
                    {score}
                  </label>
                ))}
              </div>
            ) : (
              <Textarea
                name={`answer_${q.id}`}
                rows={3}
                defaultValue={initial != null ? String(initial) : undefined}
              />
            )}
          </div>
        );
      })}
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="submit" variant="primary" disabled={pending}>
        {isEdit ? "응답 수정" : "제출"}
      </Button>
    </form>
  );
}
