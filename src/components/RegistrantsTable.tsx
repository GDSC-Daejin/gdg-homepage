import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { AttendanceToggle } from "@/components/AttendanceToggle";
import type { RegistrationStatus } from "@/lib/types";
import { displayName } from "@/lib/format";

interface RegistrationRow {
  id: string;
  user_id: string;
  status: RegistrationStatus;
  profiles: { name: string; nickname: string; student_no: string } | null;
}

const STATUS_LABEL: Record<RegistrationStatus, string> = {
  confirmed: "확정",
  waitlisted: "대기",
};

const STATUS_TONE: Record<RegistrationStatus, "success" | "neutral"> = {
  confirmed: "success",
  waitlisted: "neutral",
};

interface RegistrantsTableProps {
  eventId: string;
}

export async function RegistrantsTable({ eventId }: RegistrantsTableProps) {
  const supabase = await createClient();

  const [{ data: registrationsData }, { data: attendancesData }] = await Promise.all([
    supabase
      .from("event_registrations")
      .select("id, user_id, status, profiles(name, nickname, student_no)")
      .eq("event_id", eventId)
      .order("status", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("attendances").select("user_id").eq("event_id", eventId),
  ]);

  const registrations = (registrationsData as unknown as RegistrationRow[]) ?? [];
  const attendedUserIds = new Set((attendancesData ?? []).map((a) => a.user_id));
  const confirmedCount = registrations.filter((r) => r.status === "confirmed").length;
  const waitlistedCount = registrations.filter((r) => r.status === "waitlisted").length;

  return (
    <Card className="overflow-x-auto p-0">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 text-gray-500"
          >
            <circle cx="10" cy="6.5" r="3" />
            <path d="M3.5 16c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6" />
          </svg>
          <p className="text-sm font-semibold text-gray-900">신청자 목록</p>
        </div>
        {registrations.length > 0 && (
          <p className="text-xs text-gray-400">
            확정 {confirmedCount} · 대기 {waitlistedCount}
          </p>
        )}
      </div>
      {registrations.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="신청자가 없어요"
            description="아직 이 이벤트에 신청한 회원이 없어요. 신청이 들어오면 여기에 표시돼요."
          />
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">학번</th>
              <th className="px-4 py-3 font-medium">상태</th>
              <th className="px-4 py-3 font-medium">출석</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {displayName(row.profiles?.name || "(이름 없음)", row.profiles?.nickname)}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {row.profiles?.student_no || "-"}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                </td>
                <td className="px-4 py-3">
                  <AttendanceToggle
                    eventId={eventId}
                    userId={row.user_id}
                    attended={attendedUserIds.has(row.user_id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
