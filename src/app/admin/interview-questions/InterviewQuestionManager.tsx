"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createInterviewQuestion,
  updateInterviewQuestion,
  deleteInterviewQuestion,
} from "@/actions/interview-question";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { POSITION_LABELS } from "@/lib/types";
import type { InterviewQuestion, Position } from "@/lib/types";

type Tab = Position | "common";

const TABS: { key: Tab; label: string }[] = [
  { key: "frontend", label: POSITION_LABELS.frontend },
  { key: "backend", label: POSITION_LABELS.backend },
  { key: "designer", label: POSITION_LABELS.designer },
  { key: "beginner", label: POSITION_LABELS.beginner },
  { key: "common", label: "공통" },
];

function tabPosition(tab: Tab): Position | null {
  return tab === "common" ? null : tab;
}

function QuestionRow({
  q,
  disabled,
  onSaved,
  onDeleted,
}: {
  q: InterviewQuestion;
  disabled?: boolean;
  onSaved: (id: string, body: string) => Promise<{ error?: string } | undefined>;
  onDeleted: (id: string) => Promise<{ error?: string } | undefined>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(q.body);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(undefined);
    startTransition(async () => {
      const result = await onSaved(q.id, value);
      if (result?.error) return setError(result.error);
      setEditing(false);
    });
  }

  function handleDelete() {
    setError(undefined);
    startTransition(async () => {
      const result = await onDeleted(q.id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <Card className="flex flex-col gap-2 p-4">
      {editing ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="primary" disabled={pending || disabled} onClick={handleSave}>
              저장
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setValue(q.body);
                setEditing(false);
                setError(undefined);
              }}
            >
              취소
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <p className="whitespace-pre-wrap text-sm text-gray-800">{q.body}</p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={disabled}
              className="text-xs font-medium text-gray-500 hover:text-primary disabled:opacity-50"
            >
              수정
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={disabled || pending}
              className="text-xs font-medium text-gray-500 hover:text-danger disabled:opacity-50"
            >
              삭제
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </Card>
  );
}

export function InterviewQuestionManager({
  questions,
}: {
  questions: InterviewQuestion[];
}) {
  const [tab, setTab] = useState<Tab>("frontend");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const list = useMemo(() => {
    const pos = tabPosition(tab);
    return questions.filter((q) => q.position === pos);
  }, [questions, tab]);

  function handleCreate() {
    setError(undefined);
    if (!body.trim()) return setError("질문을 입력해주세요");
    startTransition(async () => {
      const result = await createInterviewQuestion(tabPosition(tab), body.trim());
      if (result?.error) return setError(result.error);
      setBody("");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="면접 질문 관리"
        description="포지션별 면접 질문을 만들고 수정·삭제해요. 공통 질문은 모든 포지션 면접에 함께 표시돼요."
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setError(undefined);
            }}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <p className="mb-2 text-xs font-medium text-gray-700">
          새 질문 추가 · {TABS.find((t) => t.key === tab)?.label}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="예) 최근에 가장 몰입했던 프로젝트를 소개해주세요"
            />
          </div>
          <Button type="button" variant="primary" disabled={pending} onClick={handleCreate}>
            질문 추가
          </Button>
        </div>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </Card>

      {list.length === 0 ? (
        <EmptyState
          icon={<span className="text-2xl">📝</span>}
          title="아직 질문이 없어요"
          description="위 입력창에서 이 포지션의 첫 질문을 만들어보세요."
        />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-gray-700">
            질문 <span className="text-gray-400">{list.length}개</span>
          </p>
          {list.map((q) => (
            <QuestionRow
              key={q.id}
              q={q}
              disabled={pending}
              onSaved={updateInterviewQuestion}
              onDeleted={deleteInterviewQuestion}
            />
          ))}
        </div>
      )}
    </div>
  );
}
