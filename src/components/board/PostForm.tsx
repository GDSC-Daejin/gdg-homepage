"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPost, updatePost } from "@/actions/post";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/cn";
import type { BoardType } from "@/lib/types";

interface EventOption {
  id: string;
  title: string;
}

const PLACEHOLDER: Record<BoardType, { title: string; body: string }> = {
  free: {
    title: "제목을 입력하세요",
    body: "자유롭게 이야기를 나눠보세요.\n\n마크다운 지원 — **굵게**, `코드`, - 목록, [링크](https://)",
  },
  qna: {
    title: "무엇이 궁금한가요?",
    body: "상황과 시도한 방법을 함께 적으면 좋은 답을 받기 쉬워요.\n\n마크다운 지원 — **굵게**, `코드`, - 목록, [링크](https://)",
  },
};

export function PostForm({
  board,
  eventOptions,
  editing,
  onCancel,
}: {
  board: BoardType;
  eventOptions: EventOption[];
  editing?: { id: string; title: string; body: string; event_id: string | null };
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [body, setBody] = useState(editing?.body ?? "");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const basePath = board === "qna" ? "/qna" : "/board";
  const ph = PLACEHOLDER[board];

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
        setTitle("");
        setBody("");
        setTab("write");
        if ("id" in result && result.id) router.push(`${basePath}/${result.id}`);
      }
    });
  }

  const tabClass = (active: boolean) =>
    cn(
      "rounded px-2 py-1 transition-colors",
      active ? "bg-primary-soft text-primary" : "text-gray-500 hover:bg-gray-100",
    );

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Input
          name="title"
          label="제목"
          placeholder={ph.title}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
        />
        <p className="self-end text-xs text-gray-400">{title.length}/120</p>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">내용</span>
          <div className="flex gap-1 text-xs">
            <button type="button" onClick={() => setTab("write")} className={tabClass(tab === "write")}>
              쓰기
            </button>
            <button
              type="button"
              onClick={() => setTab("preview")}
              className={tabClass(tab === "preview")}
            >
              미리보기
            </button>
          </div>
        </div>

        <Textarea
          name="body"
          rows={8}
          placeholder={ph.body}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          error={error}
          className={cn(tab === "preview" && "hidden")}
        />
        {tab === "preview" && (
          <div className="min-h-[8rem] rounded-md border border-gray-200 bg-white px-3 py-2 dark:bg-gray-100">
            {body.trim() ? (
              <Markdown>{body}</Markdown>
            ) : (
              <p className="text-sm text-gray-400">미리보기할 내용이 없어요</p>
            )}
          </div>
        )}
        <p className="self-end text-xs text-gray-400">{body.length}자</p>
      </div>

      {eventOptions.length > 0 && (
        <Select name="event_id" label="관련 이벤트 (선택)" defaultValue={editing?.event_id ?? ""}>
          <option value="">연결 안 함</option>
          {eventOptions.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </Select>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={onCancel}
            disabled={pending}
          >
            취소
          </Button>
        )}
        <Button type="submit" variant="primary" className="flex-1" disabled={pending}>
          {pending ? "저장 중…" : editing ? "수정" : "작성"}
        </Button>
      </div>
    </form>
  );
}
