import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { RegistrationActions } from "@/components/RegistrationActions";
import type { Profile, RegistrationStatus } from "@/lib/types";

interface RegistrationPanelProps {
  eventId: string;
  profile: Profile;
}

export async function RegistrationPanel({ eventId, profile }: RegistrationPanelProps) {
  const supabase = await createClient();
  const { data: registration } = await supabase
    .from("event_registrations")
    .select("status")
    .eq("event_id", eventId)
    .eq("user_id", profile.id)
    .maybeSingle<{ status: RegistrationStatus }>();

  let waitlistPosition: number | null = null;
  if (registration?.status === "waitlisted") {
    const { data } = await supabase.rpc("my_waitlist_position", {
      p_event_id: eventId,
    });
    waitlistPosition = typeof data === "number" ? data : null;
  }

  return (
    <Card className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-gray-900">내 신청 상태</p>
        {registration?.status === "confirmed" && (
          <Badge tone="success" className="mt-1">
            신청 확정
          </Badge>
        )}
        {registration?.status === "waitlisted" && (
          <Badge tone="warning" className="mt-1">
            대기 {waitlistPosition ?? "-"}번째
          </Badge>
        )}
        {!registration && (
          <Badge tone="neutral" className="mt-1">
            미신청
          </Badge>
        )}
      </div>
      <RegistrationActions eventId={eventId} status={registration?.status ?? null} />
    </Card>
  );
}
