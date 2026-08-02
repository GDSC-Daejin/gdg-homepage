"use client";

import { useState, useTransition } from "react";
import { setAttendance } from "@/actions/attendance";
import { Badge } from "@/components/Badge";
import { cn } from "@/lib/cn";

export function AttendanceToggle({
  eventId,
  userId,
  attended,
}: {
  eventId: string;
  userId: string;
  attended: boolean;
}) {
  const [present, setPresent] = useState(attended);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !present;
    setPresent(next);
    setError(undefined);
    startTransition(async () => {
      const result = await setAttendance(eventId, userId, next);
      if (result?.error) {
        setError(result.error);
        setPresent(!next);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        title={present ? "출석 취소" : "출석 처리"}
        className={cn(
          "rounded-md transition-opacity hover:opacity-70",
          pending && "opacity-50",
        )}
      >
        {present ? (
          <Badge tone="success">출석</Badge>
        ) : (
          <Badge tone="neutral">미출석</Badge>
        )}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
