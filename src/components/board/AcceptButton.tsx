"use client";

import { useTransition } from "react";
import { acceptAnswer } from "@/actions/post";
import { Button } from "@/components/Button";

export function AcceptButton({
  postId,
  commentId,
  accepted,
}: {
  postId: string;
  commentId: string;
  accepted: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(() => {
      acceptAnswer(postId, accepted ? null : commentId);
    });
  }

  return (
    <Button
      type="button"
      variant={accepted ? "secondary" : "ghost"}
      size="sm"
      onClick={handleClick}
      disabled={pending}
    >
      {accepted ? "채택됨 (해제)" : "채택하기"}
    </Button>
  );
}
