"use client";

import { useState, useTransition } from "react";
import { sendAttendanceWarning } from "@/actions/attendance-warning";
import { Button } from "@/components/Button";

export function SendWarningButton() {
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setMessage(undefined);
    startTransition(async () => {
      const result = await sendAttendanceWarning();
      if (result.error) {
        setMessage(result.error);
        return;
      }
      if (result.skipped) {
        setMessage("오늘은 이미 보냈어요 (하루 한 번만 나가요)");
        return;
      }
      setMessage(
        result.count && result.count > 0
          ? `출석률 미달 ${result.count}명 명단을 운영진 채널로 보냈어요`
          : "출석률 미달 회원이 없어요",
      );
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
        슬랙으로 발송
      </Button>
      {message && <p className="text-xs text-gray-500">{message}</p>}
    </div>
  );
}
