"use client";

import { useState, useTransition } from "react";
import { registerForEvent, cancelRegistration } from "@/actions/registration";
import { Button } from "@/components/Button";
import type { RegistrationStatus } from "@/lib/types";

interface RegistrationActionsProps {
  eventId: string;
  status: RegistrationStatus | null;
}

export function RegistrationActions({ eventId, status }: RegistrationActionsProps) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleRegister() {
    setError(undefined);
    startTransition(async () => {
      const result = await registerForEvent(eventId);
      if (result.error) setError(result.error);
    });
  }

  function handleCancel() {
    setError(undefined);
    startTransition(async () => {
      const result = await cancelRegistration(eventId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {status ? (
        <Button variant="danger" size="sm" onClick={handleCancel} disabled={pending}>
          신청 취소
        </Button>
      ) : (
        <Button variant="primary" size="sm" onClick={handleRegister} disabled={pending}>
          신청하기
        </Button>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
