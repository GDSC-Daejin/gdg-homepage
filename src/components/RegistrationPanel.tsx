import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { RegistrationActions } from "@/components/RegistrationActions";
import { AttendanceCheckIn } from "@/components/AttendanceCheckIn";
import type { Profile, RegistrationStatus } from "@/lib/types";

interface RegistrationPanelProps {
  eventId: string;
  profile: Profile;
  code?: string;
}

export async function RegistrationPanel({ eventId, profile, code }: RegistrationPanelProps) {
  const supabase = await createClient();
  const [{ data: registration }, { data: attendance }] = await Promise.all([
    supabase
      .from("event_registrations")
      .select("status")
      .eq("event_id", eventId)
      .eq("user_id", profile.id)
      .maybeSingle<{ status: RegistrationStatus }>(),
    supabase
      .from("attendances")
      .select("event_id")
      .eq("event_id", eventId)
      .eq("user_id", profile.id)
      .maybeSingle<{ event_id: string }>(),
  ]);

  let waitlistPosition: number | null = null;
  if (registration?.status === "waitlisted") {
    const { data } = await supabase.rpc("my_waitlist_position", {
      p_event_id: eventId,
    });
    waitlistPosition = typeof data === "number" ? data : null;
  }

  const attended = !!attendance;
  const canCheckIn = registration?.status === "confirmed" && !attended;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">내 신청 상태</p>
          <div className="mt-1 flex gap-1.5">
            {registration?.status === "confirmed" && (
              <Badge tone="success">신청 확정</Badge>
            )}
            {registration?.status === "waitlisted" && (
              <Badge tone="warning">대기 {waitlistPosition ?? "-"}번째</Badge>
            )}
            {!registration && <Badge tone="neutral">미신청</Badge>}
            <Badge tone={attended ? "primary" : "neutral"}>
              {attended ? "출석 완료" : "미출석"}
            </Badge>
          </div>
        </div>
        <RegistrationActions eventId={eventId} status={registration?.status ?? null} />
      </div>

      {canCheckIn && (
        <div className="border-t border-gray-200 pt-4">
          <p className="mb-3 text-sm font-semibold text-gray-900">출석 체크</p>
          <AttendanceCheckIn eventId={eventId} defaultCode={code} />
        </div>
      )}
    </Card>
  );
}
