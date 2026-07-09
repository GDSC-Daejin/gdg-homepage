"use client";

import { useState, useTransition } from "react";
import { grantPoints } from "@/actions/points";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import type { Profile, Event } from "@/lib/types";

interface GrantPointsFormProps {
  members: Profile[];
  events: Event[];
}

export function GrantPointsForm({ members, events }: GrantPointsFormProps) {
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(undefined);
    setSaved(false);
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
            {m.student_no ? ` · ${m.student_no}` : ""}
          </option>
        ))}
      </Select>
      <Input
        type="number"
        name="amount"
        label="포인트 (차감은 음수)"
        required
      />
      <Input name="reason" label="사유" required />
      <Select name="event_id" label="이벤트 연결 (선택)" defaultValue="">
        <option value="">연결 안 함</option>
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title}
          </option>
        ))}
      </Select>
      {error && <p className="text-xs text-danger">{error}</p>}
      {saved && !error && (
        <p className="text-xs text-success">포인트를 부여했어요</p>
      )}
      <Button
        type="submit"
        variant="primary"
        className="mt-2"
        disabled={pending}
      >
        부여
      </Button>
    </form>
  );
}
