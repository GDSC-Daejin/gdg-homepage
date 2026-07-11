"use client";

import { useState, useTransition } from "react";
import { submitApplication } from "@/actions/application";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import { Button } from "@/components/Button";

const QUESTIONS = [
  { name: "intro", label: "자기소개" },
  { name: "motivation", label: "지원 동기" },
  { name: "interest", label: "관심 분야" },
] as const;

export function ApplyForm() {
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await submitApplication(formData);
      if (result?.error) setError(result.error);
      else setDone(true);
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
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input name="applicant_name" label="이름" required />
        <Input name="student_no" label="학번" required />
        <Input name="major" label="전공" required />
        <Input name="phone" label="전화번호" type="tel" required />
      </div>
      <Input name="email" label="이메일" type="email" required />
      {QUESTIONS.map((q) => (
        <Textarea key={q.name} name={q.name} label={q.label} required rows={4} />
      ))}
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button
        type="submit"
        variant="primary"
        className="mt-2 w-full"
        disabled={pending}
      >
        {pending ? "제출 중..." : "제출"}
      </Button>
    </form>
  );
}
