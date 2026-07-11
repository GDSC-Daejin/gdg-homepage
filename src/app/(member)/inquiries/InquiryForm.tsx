"use client";

import { useRef, useState, useTransition } from "react";
import { submitInquiry } from "@/actions/inquiry";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import { INQUIRY_CATEGORIES, INQUIRY_CATEGORY_LABEL } from "@/lib/types";

export function InquiryForm() {
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
      <Select name="category" label="유형" defaultValue="general" required>
        {INQUIRY_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {INQUIRY_CATEGORY_LABEL[c]}
          </option>
        ))}
      </Select>
      <Input name="title" label="제목" required />
      <Textarea name="body" label="내용" rows={5} error={error} />
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
