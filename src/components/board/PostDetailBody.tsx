"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/Button";
import { PostForm } from "@/components/board/PostForm";
import type { BoardType } from "@/lib/types";

const Markdown = dynamic(() => import("@/components/Markdown").then((module) => module.Markdown), {
  loading: () => <div className="min-h-24 animate-pulse rounded-md bg-gray-100" />,
});

interface EventOption {
  id: string;
  title: string;
}

export function PostDetailBody({
  board,
  post,
  eventOptions,
  canEdit,
}: {
  board: BoardType;
  post: { id: string; title: string; body: string; event_id: string | null };
  eventOptions: EventOption[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <PostForm
        board={board}
        eventOptions={eventOptions}
        editing={post}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-lg font-bold text-gray-900">{post.title}</h1>
        {canEdit && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            수정
          </Button>
        )}
      </div>
      <Markdown>{post.body}</Markdown>
    </div>
  );
}
