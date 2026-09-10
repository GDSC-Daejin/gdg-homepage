"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelBooking, rescheduleBooking } from "@/actions/interview";
import { Button } from "@/components/Button";

interface Slot {
  id: string;
  starts_at: string;
  duration_min: number;
}

function formatSlot(slot: Slot) {
  const startsAt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(slot.starts_at));
  return `${startsAt} · ${slot.duration_min}분`;
}

export function BookingActions({
  token,
  openSlots,
  canCancel,
  canReschedule,
}: {
  token: string;
  openSlots: Slot[];
  canCancel: boolean;
  canReschedule: boolean;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function cancel() {
    if (!window.confirm("면접 예약을 취소할까요?")) return;
    setMessage(undefined);
    startTransition(async () => {
      const result = await cancelBooking(token);
      setMessage(result.error ?? result.warning ?? "면접 예약을 취소했어요.");
      if (!result.error) router.refresh();
    });
  }

  function reschedule() {
    if (!selectedId) return;
    setMessage(undefined);
    startTransition(async () => {
      const result = await rescheduleBooking(token, selectedId);
      setMessage(result.error ?? result.warning ?? "면접 일정을 변경했어요.");
      if (!result.error) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
      {canReschedule && openSlots.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={pending}
            className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700"
          >
            <option value="">변경할 시간 선택</option>
            {openSlots.map((slot) => <option key={slot.id} value={slot.id}>{formatSlot(slot)}</option>)}
          </select>
          <Button type="button" variant="secondary" disabled={pending || !selectedId} onClick={reschedule}>일정 변경</Button>
        </div>
      )}
      {canCancel && (
        <Button type="button" variant="danger-outline" disabled={pending} onClick={cancel}>예약 취소</Button>
      )}
      {!canCancel && !canReschedule && (
        <p className="text-xs text-gray-500">면접 24시간 전부터는 일정 변경이나 취소가 불가능해요.</p>
      )}
      {canReschedule && openSlots.length === 0 && (
        <p className="text-xs text-gray-500">변경할 수 있는 다른 시간이 없어요.</p>
      )}
      {message && <p className={`text-xs ${message.includes("실패") || message.includes("없어요") || message.includes("불가능") ? "text-danger" : "text-success"}`}>{message}</p>}
    </div>
  );
}
