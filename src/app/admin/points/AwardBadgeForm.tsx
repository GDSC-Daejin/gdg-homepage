"use client";

import { useState, useTransition } from "react";
import { awardBadge } from "@/actions/points";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import type { Profile, Badge as BadgeType } from "@/lib/types";

interface AwardBadgeFormProps {
  members: Profile[];
  badges: BadgeType[];
}

export function AwardBadgeForm({ members, badges }: AwardBadgeFormProps) {
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(undefined);
    setSaved(false);
    const userId = String(formData.get("user_id") || "");
    const badgeId = String(formData.get("badge_id") || "");

    startTransition(async () => {
      const result = await awardBadge(userId, badgeId);
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <Select name="user_id" label="회원" defaultValue="" required>
        <option value="" disabled>
          회원 선택
        </option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name || "(이름 없음)"}
          </option>
        ))}
      </Select>
      <Select name="badge_id" label="뱃지" defaultValue="" required>
        <option value="" disabled>
          뱃지 선택
        </option>
        {badges.map((b) => (
          <option key={b.id} value={b.id}>
            {b.icon} {b.name}
          </option>
        ))}
      </Select>
      {error && <p className="text-xs text-danger">{error}</p>}
      {saved && !error && <p className="text-xs text-success">수여했어요</p>}
      <Button
        type="submit"
        variant="primary"
        className="mt-2"
        disabled={pending}
      >
        수여
      </Button>
    </form>
  );
}
