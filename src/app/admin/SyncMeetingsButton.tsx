"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncMeetingsFromNotion } from "@/actions/meeting";
import { Button } from "@/components/Button";

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
    >
      <circle cx="12" cy="12" r="9" strokeOpacity={0.3} />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </svg>
  );
}

export function SyncMeetingsButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const [isError, setIsError] = useState(false);

  function handleSync() {
    setMessage(undefined);
    startTransition(async () => {
      const result = await syncMeetingsFromNotion();
      if (result.error) {
        setIsError(true);
        setMessage(result.error);
        return;
      }
      setIsError(false);
      setMessage(`동기화 완료 · 반영 ${result.synced ?? 0}건, 제거 ${result.removed ?? 0}건`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleSync}
        disabled={pending}
        className="gap-1.5"
      >
        {pending && <Spinner />}
        노션에서 회의록 동기화
      </Button>
      {message && (
        <p
          className={`rounded-md px-2 py-1 text-xs ${
            isError ? "bg-danger-soft text-danger" : "bg-gray-50 text-gray-600"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
