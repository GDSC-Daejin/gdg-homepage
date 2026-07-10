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

  const icon = (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M4 10a6 6 0 0 1 10.5-3.9M16 10a6 6 0 0 1-10.5 3.9" />
      <path d="M13.5 3.5v3h-3M6.5 16.5v-3h3" />
    </svg>
  );

  if (!hasCode) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          onClick={handleClick}
          disabled={pending}
          className="w-full gap-2"
        >
          {icon}
          {pending ? "발급 중..." : "코드 발급"}
        </Button>
        <p className="text-center text-xs text-gray-400">
          코드를 발급하면 QR과 출석 URL이 함께 만들어져요.
        </p>
        {error && <p className="text-center text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        size="sm"
        onClick={handleClick}
        disabled={pending}
        className="gap-1.5"
      >
        {icon}
        {pending ? "재발급 중..." : "코드 재발급"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
