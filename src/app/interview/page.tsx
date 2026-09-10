import Link from "next/link";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { createClient } from "@/lib/supabase/server";
import { BookingForm } from "./BookingForm";
import { BookingActions } from "./BookingActions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "면접 일정 예약 · GDGOC DJU",
  robots: { index: false, follow: false },
};

interface InterviewContext {
  applicant_name: string;
  season: string;
  booked_slot: {
    id: string;
    starts_at: string;
    duration_min: number;
    meet_uri: string | null;
    can_cancel: boolean;
    can_reschedule: boolean;
  } | null;
  open_slots: { id: string; starts_at: string; duration_min: number }[];
  can_book: boolean;
}

function formatSlot(startsAt: string, durationMin: number) {
  const formatted = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(startsAt));
  return `${formatted} · ${durationMin}분`;
}

function formatDeadline(startsAt: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(new Date(startsAt).getTime() - 24 * 60 * 60 * 1000));
}

export default async function InterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const validToken = typeof token === "string" ? token : undefined;
  let context: InterviewContext | null = null;

  if (validToken) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_interview_context", {
      p_token: validToken,
    });
    if (!error && data) context = data as InterviewContext;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-12">
      <div className="mb-6">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← GDGOC DJU
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900">면접 일정 예약</h1>
      </div>
      {!context || !validToken ? (
        <Card className="flex flex-col items-center gap-2 text-center">
          <p className="text-base font-semibold text-gray-900">유효하지 않은 링크예요</p>
          <p className="text-sm text-gray-500">안내받은 링크를 다시 확인해주세요.</p>
          <Link href="/">
            <Button type="button" variant="secondary" className="mt-2">
              메인으로 돌아가기
            </Button>
          </Link>
        </Card>
      ) : context.booked_slot ? (
          <Card className="flex flex-col gap-3">
          <p className="text-base font-semibold text-gray-900">
            {context.applicant_name}님의 면접 예약이 확정됐어요
          </p>
          <p className="text-sm text-gray-600">
            {formatSlot(context.booked_slot.starts_at, context.booked_slot.duration_min)}
          </p>
          <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
            <p className="font-medium text-gray-700">취소·변경 안내</p>
            <p className="mt-1">{formatDeadline(context.booked_slot.starts_at)}까지 취소·변경할 수 있어요.</p>
            <p className="mt-1">일정 변경은 지원자당 1회만 가능해요.</p>
          </div>
          {context.booked_slot.meet_uri ? (
            <a
              href={context.booked_slot.meet_uri}
              className="text-sm font-medium text-primary underline"
            >
              Google Meet 참여 링크
            </a>
          ) : (
            <p className="text-sm text-gray-500">Meet 링크는 운영진이 안내드릴게요.</p>
          )}
          <BookingActions
            token={validToken}
            openSlots={context.open_slots}
            canCancel={context.booked_slot.can_cancel}
            canReschedule={context.booked_slot.can_reschedule}
          />
        </Card>
      ) : (
        <Card>
          <p className="mb-1 text-base font-semibold text-gray-900">
            {context.applicant_name}님, 반가워요
          </p>
          <p className="mb-5 text-sm text-gray-500">{context.season} 면접 시간을 예약해주세요.</p>
          {context.can_book ? (
            <BookingForm token={validToken} openSlots={context.open_slots} />
          ) : (
            <p className="text-sm text-gray-500">면접 일정 변경 횟수를 모두 사용했어요.</p>
          )}
        </Card>
      )}
    </div>
  );
}
