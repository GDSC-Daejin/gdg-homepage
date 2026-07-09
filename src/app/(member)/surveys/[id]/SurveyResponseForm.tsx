"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitSurveyResponse } from "@/actions/survey";
import { Button } from "@/components/Button";
import type { SurveyQuestion } from "@/lib/types";

interface SurveyResponseFormProps {
  surveyId: string;
  questions: SurveyQuestion[];
}

const RATING_OPTIONS = [1, 2, 3, 4, 5];

export function SurveyResponseForm({ surveyId, questions }: SurveyResponseFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await submitSurveyResponse(surveyId, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      {questions.map((q) => (
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
                    required
                  />
                  {score}
                </label>
              ))}
            </div>
          ) : (
            <textarea
              name={`answer_${q.id}`}
              rows={3}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}
        </div>
      ))}
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="submit" variant="primary" disabled={pending}>
        제출
      </Button>
    </form>
  );
}
