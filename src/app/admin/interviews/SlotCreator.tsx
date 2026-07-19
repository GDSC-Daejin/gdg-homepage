"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSlots } from "@/actions/interview";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

export function SlotCreator() {
  const [slots, setSlots] = useState([""]);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function updateSlot(index: number, value: string) {
    setSlots((current) => current.map((slot, i) => (i === index ? value : slot)));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const formData = new FormData();
    for (const slot of slots) {
      if (slot) formData.append("starts_at", new Date(slot).toISOString());
    }
    formData.set("duration_min", new FormData(event.currentTarget).get("duration_min")?.toString() ?? "30");

    startTransition(async () => {
      const result = await createSlots(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSlots([""]);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {slots.map((slot, index) => (
        <div key={index} className="flex gap-2">
          <Input
            type="datetime-local"
            value={slot}
            onChange={(event) => updateSlot(index, event.target.value)}
            required
            className="flex-1"
          />
          {slots.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSlots((current) => current.filter((_, i) => i !== index))}
            >
              삭제
            </Button>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-end gap-2">
        <Input name="duration_min" label="면접 시간(분)" type="number" min="1" defaultValue="30" required className="w-36" />
        <Button type="button" variant="secondary" onClick={() => setSlots((current) => [...current, ""])}>
          시간 추가
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "생성 중..." : "슬롯 만들기"}
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}
