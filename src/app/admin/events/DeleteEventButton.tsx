"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEvent } from "@/actions/event";
import { Button } from "@/components/Button";

export function DeleteEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("이벤트를 삭제할까요? 되돌릴 수 없어요.")) return;

    setError(undefined);
    startTransition(async () => {
      const result = await deleteEvent(eventId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/admin/events");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="danger"
        size="sm"
        onClick={handleDelete}
        disabled={pending}
      >
        삭제
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
