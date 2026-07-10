"use client";

import { useState, useTransition } from "react";
import { checkAttendance } from "@/actions/attendance";
import { Select } from "@/components/Select";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

interface AttendFormProps {
  events: { id: string; title: string }[];
  defaultEventId?: string;
  defaultCode?: string;
}

export function AttendForm({ events, defaultEventId, defaultCode }: AttendFormProps) {
  const [eventId, setEventId] = useState(defaultEventId ?? events[0]?.id ?? "");
  const [code, setCode] = useState(defaultCode ?? "");
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setSuccess(false);
    startTransition(async () => {
      const result = await checkAttendance(eventId, code);
      if (result.error) setError(result.error);
      else setSuccess(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Select
        label="이벤트"
        value={eventId}
        onChange={(e) => setEventId(e.target.value)}
        required
      >
        {events.map((event) => (
          <option key={event.id} value={event.id}>
            {event.title}
          </option>
        ))}
      </Select>
      <Input
        label="출석 코드"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        maxLength={6}
        placeholder="6자리 코드"
        required
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      {success && <p className="text-xs text-success">출석 처리됐어요</p>}
      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={pending || !eventId}
      >
        출석 확인
      </Button>
    </form>
  );
}
