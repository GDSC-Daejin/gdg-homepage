"use client";

import { useState, useTransition } from "react";
import { resendInterviewCancellationEmail } from "@/actions/interview";
import { Button } from "@/components/Button";

export function CancellationEmailRetryButton({ eventId }: { eventId: string }) {
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          setMessage(undefined);
          startTransition(async () => {
            const result = await resendInterviewCancellationEmail(eventId);
            setMessage(result.error ?? result.warning ?? "취소 이메일을 다시 보냈어요.");
          });
        }}
      >
        취소 메일 재발송
      </Button>
      {message && <span className={`text-xs ${message.includes("실패") || message.includes("필요") ? "text-danger" : "text-success"}`}>{message}</span>}
    </span>
  );
}
