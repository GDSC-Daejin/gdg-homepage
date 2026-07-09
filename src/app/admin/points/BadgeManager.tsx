"use client";

import { useState, useTransition } from "react";
import { createBadge, deleteBadge } from "@/actions/points";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import type { Badge as BadgeType } from "@/lib/types";

interface BadgeManagerProps {
  badges: BadgeType[];
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

  function handleDelete(id: string) {
    if (!confirm("뱃지를 삭제할까요? 되돌릴 수 없어요.")) return;

    setError(undefined);
    startTransition(async () => {
      const result = await deleteBadge(id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <form
          key={badges.length}
          action={handleCreate}
          className="flex flex-wrap items-end gap-3"
        >
          <Input
            name="icon"
            label="이모지"
            defaultValue="🏅"
            className="w-20"
            required
          />
          <Input name="name" label="이름" required />
          <Input name="description" label="설명" className="flex-1" />
          <Button type="submit" variant="primary" disabled={pending}>
            생성
          </Button>
        </form>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </Card>

      {badges.length === 0 ? (
        <EmptyState title="등록된 뱃지가 없어요" />
      ) : (
        <div className="flex flex-col gap-2">
          {badges.map((b) => (
            <Card
              key={b.id}
              className="flex items-center justify-between gap-4 p-4"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{b.icon}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{b.name}</p>
                  {b.description && (
                    <p className="text-xs text-gray-500">{b.description}</p>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => handleDelete(b.id)}
                disabled={pending}
              >
                삭제
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
