"use client";

import { useRef, useState, useTransition } from "react";
import { createSponsor } from "@/actions/budget";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

export function SponsorForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await createSponsor(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Input name="name" label="이름" required />
        <Input type="number" name="amount" label="금액" min={1} required />
        <Input name="season" label="시즌" />
        <Input name="note" label="메모" />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button
        type="submit"
        variant="primary"
        className="w-fit"
        disabled={pending}
      >
        추가
      </Button>
    </form>
  );
}
