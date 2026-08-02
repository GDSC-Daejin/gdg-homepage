"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { PostForm } from "@/components/board/PostForm";
import type { BoardType } from "@/lib/types";

interface EventOption {
  id: string;
  title: string;
}

export function PostComposer({
  board,
  eventOptions,
}: {
  board: BoardType;
  eventOptions: EventOption[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-gray-300 bg-white p-4 text-left text-sm text-gray-400 shadow-card transition-colors hover:border-primary hover:text-primary dark:bg-gray-100"
      >
        + 새 글 작성
      </button>
    );
  }

  return (
    <Card>
      <PostForm board={board} eventOptions={eventOptions} onCancel={() => setOpen(false)} />
    </Card>
  );
}
