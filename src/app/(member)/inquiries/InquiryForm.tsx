"use client";

import { useId, useRef, useState, useTransition } from "react";
import { submitInquiry } from "@/actions/inquiry";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

export function InquiryForm() {
  const bodyId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await submitInquiry(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
      <Input name="title" label="제목" required />
      <div className="flex flex-col gap-1">
        <label htmlFor={bodyId} className="text-sm font-medium text-gray-700">
          내용
        </label>
        <textarea
          id={bodyId}
          name="body"
          rows={5}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>
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
