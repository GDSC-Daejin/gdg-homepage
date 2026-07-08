"use client";

import { useId, useState, useTransition } from "react";
import { submitApplication } from "@/actions/application";
import { Button } from "@/components/Button";

const QUESTIONS = [
  { name: "intro", label: "자기소개" },
  { name: "motivation", label: "지원 동기" },
  { name: "interest", label: "관심 분야" },
] as const;

function TextareaField({ name, label }: { name: string; label: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        required
        rows={4}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-50 disabled:text-gray-400"
      />
    </div>
  );
}

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
        <TextareaField key={q.name} name={q.name} label={q.label} />
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
