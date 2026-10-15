"use client";

import { useState, useTransition } from "react";
import { submitApplication } from "@/actions/application";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import { EVENTS, trackEvent } from "@/lib/analytics";
import { POSITION_LABELS, type Position } from "@/lib/types";
import type { ApplicationQuestion } from "@/lib/types";

interface ApplyFormProps {
  openPositions: Position[];
  questionsByPosition: Partial<Record<string, ApplicationQuestion[]>>;
}

export function ApplyForm({ openPositions, questionsByPosition }: ApplyFormProps) {
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [position, setPosition] = useState<Position | "">("");
  const [pending, startTransition] = useTransition();
  const questions = position ? questionsByPosition[position] ?? [] : [];

  function handleSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await submitApplication(formData);
      if (result?.error) setError(result.error);
      else {
        trackEvent(EVENTS.applySubmit, { position });
        setDone(true);
      }
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="m8.5 12 2.5 2.5 4.5-5" />
          </svg>
        </div>
        <p className="text-base font-semibold text-gray-900">지원이 접수됐어요</p>
        <p className="text-sm text-gray-500">
          심사 결과는 입력하신 이메일로 안내드릴게요.
        </p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">지원자 정보</h2>
        <p className="mt-1 text-sm text-gray-500">연락 가능한 정보를 정확하게 입력해 주세요.</p>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Input name="applicant_name" label="이름" required />
        <Input name="student_no" label="학번" required />
        <Input name="major" label="전공" required />
        <Input name="phone" label="전화번호" type="tel" required />
        <div className="sm:col-span-2">
          <Input name="email" label="이메일" type="email" required />
        </div>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-gray-700">지원 포지션</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {openPositions.map((opt) => (
            <label
              key={opt}
              className={cn(
                "flex min-h-12 cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                position === opt
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50",
              )}
            >
              <input
                type="radio"
                name="position"
                value={opt}
                checked={position === opt}
                onChange={() => setPosition(opt)}
                required
                className="sr-only"
              />
              {POSITION_LABELS[opt]}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">지원 내용</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {questions.map((question, index) => (
            <div key={question.id} className={index === questions.length - 1 ? "sm:col-span-2" : undefined}>
              <Textarea name={question.id} label={question.label} required rows={6} />
            </div>
          ))}
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button
        type="submit"
        variant="primary"
        className="w-full sm:ml-auto sm:w-auto sm:min-w-40"
        disabled={pending}
      >
        {pending ? "제출 중..." : "제출"}
      </Button>
    </form>
  );
}
