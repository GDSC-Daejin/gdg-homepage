"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEvent } from "@/actions/event";
import { Button } from "@/components/Button";

export function DeleteEventButton({
  eventId,
  onDeleted,
}: {
  eventId: string;
  /** 넘기면 목록으로 이동하는 대신 이 콜백을 부른다(모달에서 닫기용). */
  onDeleted?: () => void;
}) {
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
      if (onDeleted) {
        router.refresh();
        onDeleted();
      } else {
        router.push("/admin/events");
      }
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
        className="gap-1.5"
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <path d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6M6 6v9.5A1.5 1.5 0 0 0 7.5 17h5a1.5 1.5 0 0 0 1.5-1.5V6" />
        </svg>
        삭제
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
