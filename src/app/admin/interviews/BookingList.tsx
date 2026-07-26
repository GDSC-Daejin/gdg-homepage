"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignInterviewer, regenerateMeetLink } from "@/actions/interview";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import type { InterviewSlot } from "@/lib/types";
import { displayName } from "@/lib/format";

interface Booking extends InterviewSlot {
  applicant_name?: string;
}

interface Interviewer {
  id: string;
  name: string;
  nickname: string;
}

function formatSlot(startsAt: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(startsAt));
}

const STATUS: Record<InterviewSlot["status"], { label: string; tone: "neutral" | "success" | "warning" | "danger" }> = {
  open: { label: "예약 가능", tone: "neutral" },
  booked: { label: "예약됨", tone: "success" },
  completed: { label: "완료", tone: "neutral" },
  canceled: { label: "취소", tone: "danger" },
};

export function BookingList({ bookings, interviewers }: { bookings: Booking[]; interviewers: Interviewer[] }) {
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function assign(slotId: string, interviewerId: string) {
    if (!interviewerId) return;
    setMessage(undefined);
    startTransition(async () => {
      const result = await assignInterviewer(slotId, interviewerId);
      setMessage(result.error ?? "면접관을 배정했어요.");
      if (!result.error) router.refresh();
    });
  }

  function regenerate(slotId: string) {
    setMessage(undefined);
    startTransition(async () => {
      const result = await regenerateMeetLink(slotId);
      setMessage(result.error ?? "Meet 링크를 생성했어요.");
      if (!result.error) router.refresh();
    });
  }

  if (bookings.length === 0) return <p className="text-sm text-gray-500">만든 면접 슬롯이 없어요.</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-3 py-2 font-medium">시간</th>
              <th className="px-3 py-2 font-medium">지원자</th>
              <th className="px-3 py-2 font-medium">면접관</th>
              <th className="px-3 py-2 font-medium">Meet</th>
              <th className="px-3 py-2 font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking.id} className="border-b border-gray-100 last:border-0">
                <td className="px-3 py-3 text-gray-700">{formatSlot(booking.starts_at)}</td>
                <td className="px-3 py-3">
                  {booking.application_id ? (
                    <Link href={`/admin/applications/${booking.application_id}`} className="font-medium text-primary hover:underline">
                      {booking.applicant_name ?? "지원자"}
                    </Link>
                  ) : "-"}
                </td>
                <td className="px-3 py-3">
                  <select
                    value={booking.interviewer_id ?? ""}
                    onChange={(event) => assign(booking.id, event.target.value)}
                    disabled={pending}
                    className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700"
                  >
                    <option value="">배정 안 함</option>
                    {interviewers.map((interviewer) => <option key={interviewer.id} value={interviewer.id}>{displayName(interviewer.name, interviewer.nickname)}</option>)}
                  </select>
                </td>
                <td className="px-3 py-3">
                  {booking.meet_uri ? (
                    <a href={booking.meet_uri} target="_blank" rel="noreferrer" className="text-primary hover:underline">링크 열기</a>
                  ) : booking.status === "booked" ? (
                    <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => regenerate(booking.id)}>재생성</Button>
                  ) : "-"}
                </td>
                <td className="px-3 py-3"><Badge tone={STATUS[booking.status].tone}>{STATUS[booking.status].label}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {message && <p className={`text-xs ${message.includes("실패") ? "text-danger" : "text-success"}`}>{message}</p>}
    </div>
  );
}
