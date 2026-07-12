"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePost } from "@/actions/post";
import { Button } from "@/components/Button";
import type { BoardType } from "@/lib/types";

export function DeletePostButton({ id, board }: { id: string; board: BoardType }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const basePath = board === "qna" ? "/qna" : "/board";

  function handleDelete() {
    // ponytail: 커스텀 확인 모달 대신 네이티브 confirm() 사용, 게시글 삭제는 빈도 낮은 동작
    if (!confirm("글을 삭제할까요? 되돌릴 수 없어요.")) return;
    startTransition(async () => {
      await deletePost(id, board);
      router.push(basePath);
    });
  }

  return (
    <Button
      type="button"
      variant="danger-outline"
      size="sm"
      onClick={handleDelete}
      disabled={pending}
    >
      삭제
    </Button>
  );
}
