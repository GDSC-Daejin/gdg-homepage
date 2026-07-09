"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishNotice } from "@/actions/notice";
import { Button } from "@/components/Button";

export function PublishNoticeButton({
  noticeId,
  published,
}: {
  noticeId: string;
  published: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handlePublish() {
    setError(undefined);
    setMessage(undefined);
    startTransition(async () => {
      const result = await publishNotice(noticeId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result?.slack) setMessage(result.slack);
      router.refresh();
    });
  }

  if (published) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={handlePublish}
        disabled={pending}
      >
        발행
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
      {message && <p className="text-xs text-gray-500">{message}</p>}
    </div>
  );
}
