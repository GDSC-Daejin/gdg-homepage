"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkAttendance } from "@/actions/attendance";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { EVENTS, trackEvent } from "@/lib/analytics";

interface AttendanceCheckInProps {
  eventId: string;
  defaultCode?: string;
}

export function AttendanceCheckIn({ eventId, defaultCode }: AttendanceCheckInProps) {
  const router = useRouter();
  const [code, setCode] = useState(defaultCode ?? "");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await checkAttendance(eventId, code);
      if (result.error) setError(result.error);
      else {
        trackEvent(EVENTS.attendanceCheck, { event_id: eventId });
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        label="출석 코드"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        maxLength={6}
        placeholder="6자리 코드"
        error={error}
        required
      />
      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={pending || !code}
      >
        출석 확인
      </Button>
    </form>
  );
}
