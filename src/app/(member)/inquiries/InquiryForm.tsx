"use client";

import { useRef, useState, useTransition } from "react";
import { submitInquiry } from "@/actions/inquiry";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
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
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-6">
      <fieldset>
        <legend className="text-sm font-semibold text-gray-800">문의 유형</legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {INQUIRY_CATEGORIES.map((category) => (
            <label key={category} className="cursor-pointer">
              <input
                className="peer sr-only"
                type="radio"
                name="category"
                value={category}
                defaultChecked={category === "general"}
              />
              <span className="flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-600 transition-colors peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:text-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
                {INQUIRY_CATEGORY_LABEL[category]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Input name="title" label="제목" placeholder="문의 내용을 한 줄로 알려주세요" required />
      <Textarea
        name="body"
        label="문의 내용"
        placeholder="상황이나 의견을 자세히 남겨주시면 더 빠르게 확인할 수 있어요."
        rows={7}
        error={error}
      />
      <Button
        type="submit"
        variant="primary"
        className="self-end px-6"
        disabled={pending}
      >
        {pending ? "보내는 중…" : "문의 보내기"}
      </Button>
    </form>
  );
}
