"use client";

import { useState, useTransition } from "react";
import { approveMember } from "@/actions/member";
import { Button } from "@/components/Button";

export function ApproveButton({ userId }: { userId: string }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-end gap-2">
      {error && <span className="text-xs text-danger">{error}</span>}
      <Button
        type="button"
        variant="primary"
        disabled={pending}
        onClick={() => {
          setError(undefined);
          startTransition(async () => {
            const result = await approveMember(userId);
            if (result?.error) setError(result.error);
          });
        }}
      >
        승인
      </Button>
    </div>
  );
}
