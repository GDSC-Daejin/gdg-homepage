import Link from "next/link";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { createClient } from "@/lib/supabase/server";
import { BookingForm } from "./BookingForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "면접 일정 예약 · GDG DJU",
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
  } | null;
  open_slots: { id: string; starts_at: string; duration_min: number }[];
}

function formatSlot(startsAt: string, durationMin: number) {
  const formatted = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(startsAt));
  return `${formatted} · ${durationMin}분`;
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
          ← GDG DJU
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
        </Card>
      ) : (
        <Card>
          <p className="mb-1 text-base font-semibold text-gray-900">
            {context.applicant_name}님, 반가워요
          </p>
          <p className="mb-5 text-sm text-gray-500">{context.season} 면접 시간을 예약해주세요.</p>
          <BookingForm token={validToken} openSlots={context.open_slots} />
        </Card>
      )}
    </div>
  );
}
