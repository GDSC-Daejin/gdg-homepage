"use client";

import { useState, useTransition } from "react";
import { grantPoints } from "@/actions/points";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { Profile, Event } from "@/lib/types";

interface GrantPointsFormProps {
  members: Profile[];
  events: Event[];
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

export function GrantPointsForm({ members, events }: GrantPointsFormProps) {
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<{ name: string; amount: number }>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(undefined);
    setSaved(undefined);
    const userId = String(formData.get("user_id") || "");
    const amount = Number(formData.get("amount"));
    const reason = String(formData.get("reason") || "");
    const eventId = String(formData.get("event_id") || "");

    startTransition(async () => {
      const result = await grantPoints(
        userId,
        amount,
        reason,
        eventId || undefined,
      );
      if (result?.error) setError(result.error);
      else {
        const name = members.find((m) => m.id === userId)?.name || "회원";
        setSaved({ name, amount });
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <circle cx="10" cy="10" r="7" />
            <path d="M10 6.5v7M6.5 10h7" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">포인트 부여</p>
          <p className="text-xs text-gray-500">차감은 포인트에 음수를 입력하세요</p>
        </div>
      </div>
      <Card>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <Select name="user_id" label="회원" defaultValue="" required>
            <option value="" disabled>
              회원 선택
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || "(이름 없음)"}
                {m.student_no ? ` · ${m.student_no}` : ""}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              type="number"
              name="amount"
              label="포인트"
              placeholder="예) 50 · 차감은 -20"
              required
            />
            <Select name="event_id" label="이벤트 연결 (선택)" defaultValue="">
              <option value="">연결 안 함</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </Select>
          </div>
          <Input
            name="reason"
            label="사유"
            placeholder="예) 모각코 운영을 도왔어요"
            required
          />
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 shrink-0"
              >
                <circle cx="10" cy="10" r="7" />
                <path d="M10 7v4M10 13.5h.01" />
              </svg>
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
              {saved.name} 님에게{" "}
              <span
                className={
                  saved.amount >= 0
                    ? "font-bold text-success"
                    : "font-bold text-danger"
                }
              >
                {saved.amount >= 0 ? `+${saved.amount}` : saved.amount}P
              </span>
              를 부여했어요.
            </div>
          )}
          <Button
            type="submit"
            variant="primary"
            className="mt-2 gap-1.5"
            disabled={pending}
          >
            {pending && <Spinner />}
            {pending ? "부여 중..." : "포인트 부여"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
