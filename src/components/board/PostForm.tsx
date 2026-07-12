"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPost, updatePost } from "@/actions/post";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import type { BoardType } from "@/lib/types";

interface EventOption {
  id: string;
  title: string;
}

export function PostForm({
  board,
  eventOptions,
  editing,
}: {
  board: BoardType;
  eventOptions: EventOption[];
  editing?: { id: string; title: string; body: string; event_id: string | null };
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const basePath = board === "qna" ? "/qna" : "/board";

  function handleSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = editing
        ? await updatePost(editing.id, board, formData)
        : await createPost(board, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (editing) {
        router.push(`${basePath}/${editing.id}`);
      } else {
        formRef.current?.reset();
        if ("id" in result && result.id) router.push(`${basePath}/${result.id}`);
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
      <Input name="title" label="제목" defaultValue={editing?.title} required />
      <Textarea
        name="body"
        label="내용"
        rows={6}
        defaultValue={editing?.body}
        error={error}
      />
      {eventOptions.length > 0 && (
        <Select
          name="event_id"
          label="관련 이벤트 (선택)"
          defaultValue={editing?.event_id ?? ""}
        >
          <option value="">연결 안 함</option>
          {eventOptions.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </Select>
      )}
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {editing ? "수정" : "작성"}
      </Button>
    </form>
  );
}
