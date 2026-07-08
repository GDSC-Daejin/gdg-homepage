"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEvent, updateEvent } from "@/actions/event";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import type { Event, EventType } from "@/lib/types";

const TYPE_OPTIONS: { value: EventType; label: string }[] = [
  { value: "session", label: "세션" },
  { value: "study", label: "스터디" },
  { value: "devfest", label: "데브페스트" },
];

function toKstDatetimeLocal(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

interface EventFormProps {
  event?: Event;
}

export function EventForm({ event }: EventFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(undefined);
    const startsAt = formData.get("starts_at");
    if (typeof startsAt === "string" && startsAt) {
      formData.set("starts_at", new Date(startsAt).toISOString());
    }
    startTransition(async () => {
      const result = event
        ? await updateEvent(event.id, formData)
        : await createEvent(formData);

      if (result?.error) {
        setError(result.error);
        return;
      }

      if (event) {
        router.refresh();
      } else {
        router.push("/admin/events");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <Select
        name="type"
        label="유형"
        defaultValue={event?.type ?? "session"}
        required
      >
        {TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
      <Input name="title" label="제목" defaultValue={event?.title} required />
      <Input name="description" label="설명" defaultValue={event?.description} />
      <Input
        type="datetime-local"
        name="starts_at"
        label="일시"
        defaultValue={event ? toKstDatetimeLocal(event.starts_at) : ""}
        required
      />
      <Input name="location" label="장소" defaultValue={event?.location} />
      <Input name="speaker" label="발표자" defaultValue={event?.speaker} />
      <Input
        type="number"
        name="capacity"
        label="정원 (선택, 비우면 무제한)"
        min={1}
        defaultValue={event?.capacity ?? undefined}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button
        type="submit"
        variant="primary"
        className="mt-2"
        disabled={pending}
      >
        {event ? "수정" : "생성"}
      </Button>
    </form>
  );
}
