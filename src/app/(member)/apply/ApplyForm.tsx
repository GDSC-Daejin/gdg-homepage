"use client";

import { useState, useTransition } from "react";
import { submitApplication } from "@/actions/application";
import { Textarea } from "@/components/Textarea";
import { Button } from "@/components/Button";

const QUESTIONS = [
  { name: "intro", label: "자기소개" },
  { name: "motivation", label: "지원 동기" },
  { name: "interest", label: "관심 분야" },
] as const;

export function ApplyForm() {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await submitApplication(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
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
        제출
      </Button>
    </form>
  );
}
