"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteNotice } from "@/actions/notice";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
    >
      <circle cx="12" cy="12" r="9" strokeOpacity={0.3} />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 6h12M8 6V4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V6M6 6l.6 9.4a1.5 1.5 0 0 0 1.5 1.4h3.8a1.5 1.5 0 0 0 1.5-1.4L14 6" />
      <path d="M8.5 9v4.5M11.5 9v4.5" />
    </svg>
  );
}

export function DeleteNoticeButton({
  noticeId,
  title,
  disabled,
}: {
  noticeId: string;
  title: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleDelete() {
    setError(undefined);
    startTransition(async () => {
      const result = await deleteNotice(noticeId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.push("/admin/notices");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="danger-outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="gap-1.5"
      >
        <TrashIcon className="h-3.5 w-3.5" />
        삭제
      </Button>
      {error && (
        <p className="rounded-md bg-danger-soft px-2 py-1 text-xs text-danger">{error}</p>
      )}
      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft">
          <TrashIcon className="h-6 w-6 text-danger" />
        </div>
        <h2 className="mt-3 text-base font-semibold text-gray-900">공지를 삭제할까요?</h2>
        <p className="mt-1 text-sm text-gray-500">
          삭제하면 되돌릴 수 없어요. 이미 발행된 공지라면 회원에게 더 이상 보이지 않게 돼요.
        </p>
        <p className="mt-3 truncate rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
          {title}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            취소
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            disabled={pending}
            className="gap-1.5"
          >
            {pending && <Spinner />}
            삭제
          </Button>
        </div>
      </Modal>
    </div>
  );
}
