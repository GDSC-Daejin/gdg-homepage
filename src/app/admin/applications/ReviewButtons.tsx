"use client";

import { useState, useTransition } from "react";
import { reviewApplication } from "@/actions/application";
import { Button } from "@/components/Button";
import type { ApplicationStatus } from "@/lib/types";

export function ReviewButtons({
  id,
  status,
}: {
  id: string;
  status: ApplicationStatus;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (status !== "pending") return null;

  function handleReview(next: "accepted" | "rejected") {
    const message = next === "accepted" ? "합격 처리할까요?" : "불합격 처리할까요?";
    if (!confirm(message)) return;
    setError(undefined);
    startTransition(async () => {
      const result = await reviewApplication(id, next);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={pending}
          onClick={() => handleReview("accepted")}
        >
          합격
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() => handleReview("rejected")}
        >
          불합격
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
