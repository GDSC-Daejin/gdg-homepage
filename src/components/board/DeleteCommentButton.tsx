"use client";

import { useTransition } from "react";
import { deleteComment } from "@/actions/post";
import { Button } from "@/components/Button";
import type { BoardType } from "@/lib/types";

export function DeleteCommentButton({
  id,
  postId,
  board,
}: {
  id: string;
  postId: string;
  board: BoardType;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("댓글을 삭제할까요?")) return;
    startTransition(() => {
      deleteComment(id, postId, board);
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={pending}
      className="text-danger hover:bg-danger-soft"
    >
      삭제
    </Button>
  );
}
