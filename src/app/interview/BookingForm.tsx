"use client";

import { useState, useTransition } from "react";
import { bookSlot } from "@/actions/interview";
import { Button } from "@/components/Button";

interface Slot {
  id: string;
  starts_at: string;
  duration_min: number;
}

function formatSlot(slot: Slot) {
  const startsAt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(slot.starts_at));
  return `${startsAt} · ${slot.duration_min}분`;
}

export function BookingForm({ token, openSlots }: { token: string; openSlots: Slot[] }) {
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState<string>();
  const [warning, setWarning] = useState<string>();
  const [meetUri, setMeetUri] = useState<string>();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setWarning(undefined);
    startTransition(async () => {
      const result = await bookSlot(token, selectedId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMeetUri(result.meetUri);
      setWarning(result.warning);
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <p className="text-base font-semibold text-gray-900">면접 예약이 확정됐어요</p>
        {meetUri ? (
          <a href={meetUri} className="text-sm font-medium text-primary underline">
            Google Meet 참여 링크
          </a>
        ) : (
          <p className="text-sm text-gray-500">
            Meet 링크는 운영진이 확인 후 안내드릴게요.
          </p>
        )}
        {warning && <p className="text-sm text-warning">{warning}</p>}
      </div>
    );
  }

  if (openSlots.length === 0) {
    return <p className="text-sm text-gray-500">선택할 수 있는 면접 시간이 없어요.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm font-medium text-gray-700">면접 시간을 선택해주세요</p>
      <div className="flex flex-col gap-2">
        {openSlots.map((slot) => (
          <label
            key={slot.id}
            className={`cursor-pointer rounded-lg border px-3 py-3 text-sm transition-colors ${
              selectedId === slot.id
                ? "border-primary bg-primary-soft text-primary"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <input
              type="radio"
              name="slot"
              value={slot.id}
              checked={selectedId === slot.id}
              onChange={() => setSelectedId(slot.id)}
              className="sr-only"
            />
            {formatSlot(slot)}
          </label>
        ))}
      </div>
      {error && (
        <div className="text-xs text-danger">
          <p>{error}</p>
          {error.includes("마감된 시간") && <p>목록을 새로고침한 뒤 다시 선택해주세요.</p>}
        </div>
      )}
      <Button type="submit" variant="primary" className="mt-2 w-full" disabled={!selectedId || pending}>
        {pending ? "예약 중..." : "예약하기"}
      </Button>
    </form>
  );
}
