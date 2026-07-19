"use client";

import { useState, useTransition } from "react";
import { createBadge, deleteBadge } from "@/actions/points";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import type { Badge as BadgeType } from "@/lib/types";

interface BadgeManagerProps {
  badges: BadgeType[];
}

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
    >
      <circle cx="12" cy="12" r="9" strokeOpacity={0.3} />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </svg>
  );
}

function BadgeCard({
  badge,
  disabled,
  onDeleted,
}: {
  badge: BadgeType;
  disabled?: boolean;
  onDeleted: (id: string) => Promise<{ error?: string } | undefined>;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleDelete() {
    setError(undefined);
    startTransition(async () => {
      const result = await onDeleted(badge.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Card className="relative flex flex-col items-center gap-2 p-4 text-center">
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-danger disabled:pointer-events-none disabled:opacity-50"
        aria-label="뱃지 삭제"
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M4.5 5.5h11M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M6 5.5v9.5a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V5.5" />
        </svg>
      </button>
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-3xl">
        {badge.icon}
      </div>
      <p className="text-sm font-bold text-gray-900">{badge.name}</p>
      {badge.description && (
        <p className="line-clamp-2 text-sm text-gray-500">{badge.description}</p>
      )}

      <Modal open={open} onClose={() => setOpen(false)} className="text-left">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 text-danger"
          >
            <path d="M4.5 5.5h11M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M6 5.5v9.5a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V5.5" />
          </svg>
        </div>
        <h2 className="mt-3 text-base font-semibold text-gray-900">
          이 뱃지를 삭제할까요?
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          삭제하면 되돌릴 수 없어요. 이미 이 뱃지를 받은 회원의 기록에도 영향을 줄 수 있어요.
        </p>
        <div className="mt-4 flex items-center gap-3 rounded-md bg-gray-50 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-gray-200 text-lg shadow-card">
            {badge.icon}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{badge.name}</p>
            {badge.description && (
              <p className="text-xs text-gray-500">{badge.description}</p>
            )}
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            취소
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            disabled={pending}
            className="gap-1.5"
          >
            {pending && <Spinner />}
            삭제
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

export function BadgeManager({ badges }: BadgeManagerProps) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleCreate(formData: FormData) {
    setError(undefined);
    const name = String(formData.get("name") || "");
    const description = String(formData.get("description") || "");
    const icon = String(formData.get("icon") || "");

    startTransition(async () => {
      const result = await createBadge(name, description, icon);
      if (result?.error) setError(result.error);
    });
  }

  async function handleDelete(id: string) {
    setError(undefined);
    return deleteBadge(id);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">뱃지 관리</h2>
        <p className="text-sm text-gray-500">뱃지 종류를 새로 만들거나 삭제해요</p>
      </div>

      <Card>
        <p className="mb-2 text-xs font-medium text-gray-700">새 뱃지 만들기</p>
        <form
          key={badges.length}
          action={handleCreate}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="sm:w-20">
            <Input name="icon" label="아이콘" defaultValue="🏅" required />
          </div>
          <div className="sm:w-48">
            <Input name="name" label="이름" placeholder="예) 멘토링 마스터" required />
          </div>
          <div className="flex-1">
            <Input
              name="description"
              label="설명"
              placeholder="예) 후배 3명 이상 멘토링을 완료했어요"
            />
          </div>
          <Button type="submit" variant="primary" disabled={pending}>
            뱃지 추가
          </Button>
        </form>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </Card>

      {badges.length === 0 ? (
        <EmptyState
          icon={<span className="text-2xl">🏅</span>}
          title="등록된 뱃지가 없어요"
          description="위 폼에서 첫 뱃지를 만들어 회원에게 수여해보세요."
        />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-gray-700">
            등록된 뱃지 <span className="text-gray-400">{badges.length}종</span>
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {badges.map((b) => (
              <BadgeCard key={b.id} badge={b} disabled={pending} onDeleted={handleDelete} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
