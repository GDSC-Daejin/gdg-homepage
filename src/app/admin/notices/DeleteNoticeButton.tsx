"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteNotice } from "@/actions/notice";
import { Button } from "@/components/Button";

export function DeleteNoticeButton({ noticeId }: { noticeId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("공지를 삭제할까요? 되돌릴 수 없어요.")) return;

    setError(undefined);
    startTransition(async () => {
      const result = await deleteNotice(noticeId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/admin/notices");
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
