import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { requireAdmin } from "@/lib/auth";
import { getRecruitingSettings } from "@/lib/recruiting";
import { createClient } from "@/lib/supabase/server";
import type { InterviewSlot } from "@/lib/types";
import { isDemoMode } from "@/lib/demo";
import { DEMO_APPLICATIONS, DEMO_INTERVIEW_SLOTS, DEMO_MEMBERS, DEMO_RECRUITING_SETTINGS } from "@/lib/demoData";
import { BookingList } from "./BookingList";
import { InviteSender } from "./InviteSender";
import { SlotCreator } from "./SlotCreator";

export const dynamic = "force-dynamic";

export default async function AdminInterviewsPage() {
  await requireAdmin();
  const demo = await isDemoMode();
  const settings = demo ? DEMO_RECRUITING_SETTINGS : await getRecruitingSettings();
  let slotData: InterviewSlot[];
  let applicationData: { id: string; applicant_name: string; email: string; status: string }[];
  let interviewerData: { id: string; name: string; nickname: string }[];

  if (demo) {
    slotData = DEMO_INTERVIEW_SLOTS;
    applicationData = DEMO_APPLICATIONS.filter((application) => application.season === settings.season);
    interviewerData = DEMO_MEMBERS
      .filter((member) => member.role === "organizer" || member.role === "team_member" || member.role === "member")
      .map(({ id, name, nickname }) => ({ id, name, nickname }));
  } else {
    const supabase = await createClient();
    const [{ data: slots }, { data: applications }, { data: interviewers }] = await Promise.all([
      supabase
        .from("interview_slots")
        .select("*")
        .eq("season", settings.season)
        .in("status", ["open", "booked", "completed"])
        .order("starts_at"),
      supabase
        .from("applications")
        .select("id, applicant_name, email, status")
        .eq("season", settings.season)
        .order("applicant_name"),
      supabase
        .from("profiles")
        .select("id, name, nickname")
        .in("role", ["organizer", "team_member", "member"])
        .not("approved_at", "is", null)
        .order("name"),
    ]);
    slotData = (slots ?? []) as InterviewSlot[];
    applicationData = (applications ?? []) as typeof applicationData;
    interviewerData = (interviewers ?? []) as typeof interviewerData;
  }

  const seasonApplications = applicationData;
  const applications = seasonApplications.filter((application) => application.status === "pending");
  const applicationNames = new Map(
    seasonApplications.map((application) => [application.id, application.applicant_name]),
  );
  const bookings = slotData.map((slot) => ({
    ...slot,
    applicant_name: slot.application_id ? applicationNames.get(slot.application_id) : undefined,
  }));
  const summary = [
    { label: "예약 가능", value: bookings.filter((booking) => booking.status === "open").length, hint: "열린 슬롯", emphasis: false },
    { label: "예약 완료", value: bookings.filter((booking) => booking.status === "booked").length, hint: "면접 예정", emphasis: true },
    { label: "면접 완료", value: bookings.filter((booking) => booking.interview_result === "attended").length, hint: "참석 기록", emphasis: false },
    { label: "노쇼", value: bookings.filter((booking) => booking.interview_result === "no_show").length, hint: "운영진 확인 필요", emphasis: false },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="면접 일정" description={`${settings.season} 면접 슬롯과 예약을 관리해요`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} hint={item.hint} emphasis={item.emphasis} />
        ))}
      </div>
      <Card>
        <h2 className="mb-4 text-base font-semibold text-gray-900">슬롯 만들기</h2>
        <SlotCreator />
      </Card>
      <Card>
        <h2 className="mb-4 text-base font-semibold text-gray-900">면접 링크 발송</h2>
        <InviteSender applications={applications} />
      </Card>
      <Card className="p-0">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">예약 현황</h2>
        </div>
        <div className="p-3 sm:p-6">
          <BookingList bookings={bookings} interviewers={interviewerData} />
        </div>
      </Card>
    </div>
  );
}
