"use client";

import { useState, useTransition } from "react";
import { resendApplicationInvite } from "@/actions/application";
import { Button } from "@/components/Button";

export function InviteResendButton({ applicationId }: { applicationId: string }) {
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-end gap-2">
      {message && <span className={`text-xs ${message.includes("실패") || message.includes("못") ? "text-danger" : "text-success"}`}>{message}</span>}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          setMessage(undefined);
          startTransition(async () => {
            const result = await resendApplicationInvite(applicationId);
            setMessage(result.error ?? result.warning ?? "가입 초대를 보냈어요");
          });
        }}
      >
        {pending ? "발송 중..." : "초대 재발송"}
      </Button>
    </div>
  );
}
