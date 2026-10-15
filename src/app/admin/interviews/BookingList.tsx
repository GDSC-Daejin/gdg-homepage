"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  assignInterviewer,
  cancelInterviewBooking,
  markInterviewOutcome,
  regenerateMeetLink,
  resendInterviewConfirmation,
  refreshInterviewCalendarResponse,
  rescheduleInterviewBooking,
  syncInterviewCalendar,
} from "@/actions/interview";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Avatar } from "@/components/Avatar";
import type { InterviewSlot } from "@/lib/types";

interface Booking extends InterviewSlot {
  applicant_name?: string;
}

interface Interviewer {
  id: string;
  name: string;
  nickname: string | null;
  avatar_path: string | null;
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

const CALENDAR_RESPONSE: Record<NonNullable<InterviewSlot["applicant_calendar_response"]>, string> = {
  needsAction: "응답 대기",
  accepted: "수락",
  tentative: "미정",
  declined: "거절",
};

export function BookingList({ bookings, interviewers }: { bookings: Booking[]; interviewers: Interviewer[] }) {
  const [message, setMessage] = useState<string>();
  const [newSlotByBooking, setNewSlotByBooking] = useState<Record<string, string>>({});
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function assign(slotId: string, interviewerId: string) {
    if (!interviewerId) return;
    setMessage(undefined);
    startTransition(async () => {
      const result = await assignInterviewer(slotId, interviewerId);
      setMessage(result.error ?? result.warning ?? "면접관을 배정했어요.");
      if (!result.error) {
        setActiveBookingId(null);
        router.refresh();
      }
    });
  }

  function regenerate(slotId: string) {
    setMessage(undefined);
    startTransition(async () => {
      const result = await regenerateMeetLink(slotId);
      setMessage(result.error ?? result.warning ?? "Meet 링크를 생성했어요.");
      if (!result.error) router.refresh();
    });
  }

  function syncCalendar(slotId: string) {
    setMessage(undefined);
    startTransition(async () => {
      const result = await syncInterviewCalendar(slotId);
      setMessage(result.error ?? result.warning ?? "Google Calendar 일정을 동기화했어요.");
      if (!result.error) router.refresh();
    });
  }

  function resendConfirmation(slotId: string) {
    setMessage(undefined);
    startTransition(async () => {
      const result = await resendInterviewConfirmation(slotId);
      setMessage(result.error ?? result.warning ?? "확정 이메일을 다시 보냈어요.");
    });
  }

  function refreshCalendarResponse(slotId: string) {
    setMessage(undefined);
    startTransition(async () => {
      const result = await refreshInterviewCalendarResponse(slotId);
      setMessage(result.error ?? result.warning ?? "Calendar 참석자 응답을 갱신했어요.");
      if (!result.error) router.refresh();
    });
  }

  function cancel(slotId: string) {
    if (!window.confirm("이 면접 예약을 취소할까요?")) return;
    setMessage(undefined);
    startTransition(async () => {
      const result = await cancelInterviewBooking(slotId);
      setMessage(result.error ?? result.warning ?? "면접 예약을 취소했어요.");
      if (!result.error) router.refresh();
    });
  }

  function reschedule(slotId: string) {
    const newSlotId = newSlotByBooking[slotId];
    if (!newSlotId) return;
    setMessage(undefined);
    startTransition(async () => {
      const result = await rescheduleInterviewBooking(slotId, newSlotId);
      setMessage(result.error ?? result.warning ?? "면접 일정을 변경했어요.");
      if (!result.error) router.refresh();
    });
  }

  function outcome(slotId: string, result: "attended" | "no_show") {
    const label = result === "no_show" ? "노쇼" : "참석 완료";
    if (!window.confirm(`이 면접을 ${label}로 기록할까요?`)) return;
    const reason = result === "no_show" ? window.prompt("노쇼 사유를 남겨주세요 (선택)") ?? "" : "";
    setMessage(undefined);
    startTransition(async () => {
      const actionResult = await markInterviewOutcome(slotId, result, reason);
      setMessage(actionResult.error ?? `${label}로 기록했어요.`);
      if (!actionResult.error) router.refresh();
    });
  }

  if (bookings.length === 0) return <p className="text-sm text-gray-500">만든 면접 슬롯이 없어요.</p>;
  const openSlots = bookings.filter((booking) => booking.status === "open");

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-3 py-2 font-medium">시간</th>
              <th className="px-3 py-2 font-medium">지원자</th>
              <th className="px-3 py-2 font-medium">면접관</th>
              <th className="px-3 py-2 font-medium">Meet</th>
              <th className="px-3 py-2 font-medium">Calendar</th>
              <th className="px-3 py-2 font-medium">상태</th>
              <th className="px-3 py-2 font-medium">관리</th>
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
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => setActiveBookingId(booking.id)}
                  >
                    {booking.interviewer_id
                      ? interviewerName(interviewers.find((interviewer) => interviewer.id === booking.interviewer_id))
                      : "면접관 선택"}
                  </Button>
                </td>
                <td className="px-3 py-3">
                  {booking.meet_uri ? (
                    <a href={booking.meet_uri} target="_blank" rel="noreferrer" className="text-primary hover:underline">링크 열기</a>
                  ) : booking.status === "booked" ? (
                    <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => regenerate(booking.id)}>재생성</Button>
                  ) : "-"}
                </td>
                <td className="px-3 py-3">
                  {booking.status === "booked" && booking.meet_uri ? (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => syncCalendar(booking.id)}>
                        {booking.calendar_event_id ? "다시 동기화" : "일정 동기화"}
                      </Button>
                      <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => resendConfirmation(booking.id)}>
                        확정 메일
                      </Button>
                      {booking.calendar_event_id && (
                        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => refreshCalendarResponse(booking.id)}>
                          응답 새로고침
                        </Button>
                      )}
                      {booking.calendar_event_id && (
                        <span className="text-xs text-gray-500">
                          지원자 {booking.applicant_calendar_response ? CALENDAR_RESPONSE[booking.applicant_calendar_response] : "-"}
                          {booking.interviewer_calendar_response ? ` · 면접관 ${CALENDAR_RESPONSE[booking.interviewer_calendar_response]}` : ""}
                        </span>
                      )}
                    </div>
                  ) : "-"}
                </td>
                <td className="px-3 py-3">
                  <Badge tone={booking.interview_result === "no_show" ? "danger" : STATUS[booking.status].tone}>
                    {booking.interview_result === "no_show" ? "노쇼" : booking.interview_result === "attended" ? "참석 완료" : STATUS[booking.status].label}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  {booking.status === "booked" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {openSlots.length > 0 && (
                        <>
                          <select
                            value={newSlotByBooking[booking.id] ?? ""}
                            onChange={(event) => setNewSlotByBooking((current) => ({ ...current, [booking.id]: event.target.value }))}
                            disabled={pending}
                            className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700"
                          >
                            <option value="">새 시간 선택</option>
                            {openSlots.map((slot) => <option key={slot.id} value={slot.id}>{formatSlot(slot.starts_at)}</option>)}
                          </select>
                          <Button type="button" size="sm" variant="secondary" disabled={pending || !newSlotByBooking[booking.id]} onClick={() => reschedule(booking.id)}>변경</Button>
                        </>
                      )}
                      <Button type="button" size="sm" variant="danger-outline" disabled={pending} onClick={() => cancel(booking.id)}>취소</Button>
                      {new Date(booking.starts_at).getTime() <= Date.now() && (
                        <>
                          <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => outcome(booking.id, "attended")}>참석</Button>
                          <Button type="button" size="sm" variant="danger-outline" disabled={pending} onClick={() => outcome(booking.id, "no_show")}>노쇼</Button>
                        </>
                      )}
                    </div>
                  ) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {message && <p className={`text-xs ${message.includes("실패") || message.includes("못했") ? "text-danger" : "text-success"}`}>{message}</p>}
      {activeBookingId && (
        <InterviewerModal
          interviewers={interviewers}
          pending={pending}
          onClose={() => setActiveBookingId(null)}
          onSelect={(interviewerId) => assign(activeBookingId, interviewerId)}
        />
      )}
    </div>
  );
}

function interviewerName(interviewer?: Interviewer) {
  if (!interviewer) return "면접관 선택";
  return interviewer.nickname ? `${interviewer.nickname} (${interviewer.name})` : interviewer.name;
}

function InterviewerModal({
  interviewers,
  pending,
  onClose,
  onSelect,
}: {
  interviewers: Interviewer[];
  pending: boolean;
  onClose: () => void;
  onSelect: (interviewerId: string) => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="interviewer-modal-title" className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="interviewer-modal-title" className="text-lg font-semibold text-gray-900">면접관 선택</h2>
            <p className="mt-1 text-sm text-gray-500">팀 멤버와 오거나이저 중에서 선택해 주세요.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="면접관 선택 닫기">×</button>
        </div>
        {interviewers.length > 0 ? (
          <div className="grid max-h-[min(60vh,28rem)] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
            {interviewers.map((interviewer) => (
              <button
                key={interviewer.id}
                type="button"
                disabled={pending}
                onClick={() => onSelect(interviewer.id)}
                className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 p-4 text-center transition hover:border-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-60"
              >
                <Avatar name={interviewer.name} avatarPath={interviewer.avatar_path} className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-xl font-semibold text-primary" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-gray-900">{interviewer.nickname || interviewer.name}</span>
                  {interviewer.nickname && <span className="block truncate text-xs text-gray-500">{interviewer.name}</span>}
                </span>
              </button>
            ))}
          </div>
        ) : <p className="py-8 text-center text-sm text-gray-500">선택할 수 있는 면접관이 없어요.</p>}
      </div>
    </div>
  );
}
