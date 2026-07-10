"use client";

import { useState, useTransition } from "react";
import { awardBadge } from "@/actions/points";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { Profile, Badge as BadgeType } from "@/lib/types";

interface AwardBadgeFormProps {
  members: Profile[];
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

export function AwardBadgeForm({ members, badges }: AwardBadgeFormProps) {
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [userId, setUserId] = useState("");
  const [badgeId, setBadgeId] = useState("");

  const previewMember = members.find((m) => m.id === userId);
  const previewBadge = badges.find((b) => b.id === badgeId);

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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-soft text-2xl">
          🏅
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">뱃지 수여</p>
          <p className="text-xs text-gray-500">회원의 활동을 뱃지로 기록해요</p>
        </div>
      </div>
      <Card className="flex flex-1 flex-col">
        <form action={handleSubmit} className="flex flex-1 flex-col gap-4">
          <Select
            name="user_id"
            label="회원"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
          >
            <option value="" disabled>
              회원 선택
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || "(이름 없음)"}
              </option>
            ))}
          </Select>
          <Select
            name="badge_id"
            label="뱃지"
            value={badgeId}
            onChange={(e) => setBadgeId(e.target.value)}
            required
          >
            <option value="" disabled>
              뱃지 선택
            </option>
            {badges.map((b) => (
              <option key={b.id} value={b.id}>
                {b.icon} {b.name}
              </option>
            ))}
          </Select>
          {previewMember && previewBadge && (
            <div className="flex items-center gap-3 rounded-md border border-dashed border-gray-300 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg">
                {previewBadge.icon}
              </div>
              <div>
                <p className="text-xs text-gray-400">수여 미리보기</p>
                <p className="text-sm font-medium text-gray-900">
                  {previewMember.name} 님에게{" "}
                  <span className="text-primary">{previewBadge.name}</span>{" "}
                  뱃지
                </p>
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}
          {saved && !error && (
            <div className="flex items-center gap-2 rounded-md bg-success-soft px-3 py-2 text-sm text-gray-900">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-white">
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3"
                >
                  <path d="M5 10.5 8.5 14 15 6.5" />
                </svg>
              </span>
              뱃지를 수여했어요.
            </div>
          )}
          <Button
            type="submit"
            variant="primary"
            className="mt-auto gap-1.5"
            disabled={pending}
          >
            {pending && <Spinner />}
            {pending ? "수여 중..." : "수여하기"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
