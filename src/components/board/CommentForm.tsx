"use client";

import { useRef, useState, useTransition } from "react";
import { createComment } from "@/actions/post";
import { Textarea } from "@/components/Textarea";
import { Button } from "@/components/Button";
import type { BoardType } from "@/lib/types";

export function CommentForm({ postId, board }: { postId: string; board: BoardType }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await createComment(postId, board, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-2">
      <Textarea name="body" rows={3} placeholder="댓글을 남겨보세요" error={error} />
      <Button type="submit" variant="secondary" size="sm" className="self-end" disabled={pending}>
        댓글 등록
      </Button>
    </form>
  );
}
