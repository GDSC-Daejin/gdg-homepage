"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { issueAttendanceCode } from "@/actions/attendance-admin";
import { Button } from "@/components/Button";

interface IssueCodeButtonProps {
  eventId: string;
  hasCode: boolean;
}

export function IssueCodeButton({ eventId, hasCode }: IssueCodeButtonProps) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    setError(undefined);
    startTransition(async () => {
      const result = await issueAttendanceCode(eventId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        size="sm"
        onClick={handleClick}
        disabled={pending}
      >
        {hasCode ? "코드 재발급" : "코드 발급"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
