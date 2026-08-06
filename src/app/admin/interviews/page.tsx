import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { requireAdmin } from "@/lib/auth";
import { getRecruitingSettings } from "@/lib/recruiting";
import { createClient } from "@/lib/supabase/server";
import type { InterviewSlot } from "@/lib/types";
import { BookingList } from "./BookingList";
import { InviteSender } from "./InviteSender";
import { SlotCreator } from "./SlotCreator";

export const dynamic = "force-dynamic";

export default async function AdminInterviewsPage() {
  await requireAdmin();
  const [settings, supabase] = await Promise.all([getRecruitingSettings(), createClient()]);
  const [{ data: slotData }, { data: applicationData }, { data: interviewerData }] = await Promise.all([
    supabase
      .from("interview_slots")
      .select("*")
      .eq("season", settings.season)
      .in("status", ["open", "booked"])
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

  const seasonApplications = (applicationData ?? []) as {
    id: string;
    applicant_name: string;
    email: string;
    status: string;
  }[];
  const applications = seasonApplications.filter((application) => application.status === "pending");
  const applicationNames = new Map(
    seasonApplications.map((application) => [application.id, application.applicant_name]),
  );
  const bookings = ((slotData ?? []) as InterviewSlot[]).map((slot) => ({
    ...slot,
    applicant_name: slot.application_id ? applicationNames.get(slot.application_id) : undefined,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="면접 일정" description={`${settings.season} 면접 슬롯과 예약을 관리해요`} />
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
          <BookingList bookings={bookings} interviewers={(interviewerData ?? []) as { id: string; name: string; nickname: string }[]} />
        </div>
      </Card>
    </div>
  );
}
