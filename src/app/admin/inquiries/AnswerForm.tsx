"use client";

import { useId, useState, useTransition } from "react";
import { answerInquiry } from "@/actions/inquiry";
import { Button } from "@/components/Button";

export function AnswerForm({ id }: { id: string }) {
  const textareaId = useId();
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(undefined);
    const value = String(formData.get("answer") ?? "");
    startTransition(async () => {
      const result = await answerInquiry(id, value);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4">
      <label htmlFor={textareaId} className="text-sm font-medium text-gray-700">
        답변 작성
      </label>
      <textarea
        id={textareaId}
        name="answer"
        rows={3}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-50 disabled:text-gray-400"
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button
        type="submit"
        variant="primary"
        size="sm"
        className="self-end"
        disabled={pending}
      >
        답변 등록
      </Button>
    </form>
  );
}
