"use client";

import { useState, useTransition, type FormEvent } from "react";
import { setApplicationNote } from "@/actions/application";
import { Textarea } from "@/components/Textarea";
import { Button } from "@/components/Button";

export function ReviewNoteForm({ id, note }: { id: string; note: string }) {
  const [value, setValue] = useState(note);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await setApplicationNote(id, value);
      if (result?.error) {
        setError(result.error);
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Textarea
        label="심사 메모"
        rows={4}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={pending}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          저장
        </Button>
        {saved && !error && <p className="text-xs text-success">저장했어요</p>}
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </form>
  );
}
