"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createNotice, updateNotice } from "@/actions/notice";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import type { Notice } from "@/lib/types";

interface NoticeFormProps {
  notice?: Notice;
}

export function NoticeForm({ notice }: NoticeFormProps) {
  const router = useRouter();
  const bodyId = useId();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = notice
        ? await updateNotice(notice.id, formData)
        : await createNotice(formData);

      if (result?.error) {
        setError(result.error);
        return;
      }

      if (notice) {
        router.refresh();
      } else {
        router.push("/admin/notices");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <Input name="title" label="제목" defaultValue={notice?.title} required />
      <div className="flex flex-col gap-1">
        <label htmlFor={bodyId} className="text-sm font-medium text-gray-700">
          내용
        </label>
        <textarea
          id={bodyId}
          name="body"
          rows={8}
          defaultValue={notice?.body}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button
        type="submit"
        variant="primary"
        className="mt-2"
        disabled={pending}
      >
        {notice ? "수정" : "생성"}
      </Button>
    </form>
  );
}
