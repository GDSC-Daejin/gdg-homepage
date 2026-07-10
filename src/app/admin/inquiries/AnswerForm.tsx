"use client";

import { useState, useTransition } from "react";
import { answerInquiry } from "@/actions/inquiry";
import { Textarea } from "@/components/Textarea";
import { Button } from "@/components/Button";

export function AnswerForm({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
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

  if (!open) {
    return (
      <div className="mt-4 border-t border-gray-100 pt-4">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen(true)}
        >
          답변하기
        </Button>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4">
      <Textarea
        name="answer"
        label="답변 작성"
        rows={3}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        error={error}
      />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          취소
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          답변 등록
        </Button>
      </div>
    </form>
  );
}
