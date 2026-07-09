"use client";

import { useRef, useState, useTransition } from "react";
import { createBudgetEntry } from "@/actions/budget";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";

export function BudgetEntryForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await createBudgetEntry(formData);
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
        <Input type="date" name="entry_date" label="날짜" required />
        <Select name="type" label="구분" defaultValue="income" required>
          <option value="income">수입</option>
          <option value="expense">지출</option>
        </Select>
        <Input name="category" label="분류" required />
        <Input type="number" name="amount" label="금액" min={1} required />
        <Input name="memo" label="메모" />
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
