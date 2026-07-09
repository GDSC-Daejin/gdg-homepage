import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import type { Profile } from "@/lib/types";
import { ATTENDANCE_WARNING_THRESHOLD } from "./constants";
import { SendWarningButton } from "./SendWarningButton";
import { isDemoMode } from "@/lib/demo";
import { DEMO_ATTENDANCE_ROWS } from "@/lib/demoData";

interface MemberAttendanceRow {
  member: Profile;
  confirmed: number;
  attended: number;
  rate: number | null;
}

export const dynamic = "force-dynamic";

export default async function AdminAttendancePage() {
  const demo = await isDemoMode();

  let rows: MemberAttendanceRow[] = DEMO_ATTENDANCE_ROWS;

  if (!demo) {
    const supabase = await createClient();
    const now = new Date().toISOString();

    const [{ data: membersData }, { data: pastEventsData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("role", "member")
        .eq("status", "active")
        .order("name"),
      supabase.from("events").select("id").lt("starts_at", now),
    ]);

    const members = (membersData as Profile[]) ?? [];
    const pastEventIds = (pastEventsData ?? []).map((e) => e.id);

    const confirmedByUser = new Map<string, number>();
    const attendedByUser = new Map<string, number>();

    if (pastEventIds.length > 0) {
      const [{ data: regs }, { data: attends }] = await Promise.all([
        supabase
          .from("event_registrations")
          .select("user_id, event_id")
          .eq("status", "confirmed")
          .in("event_id", pastEventIds),
        supabase
          .from("attendances")
          .select("user_id, event_id")
          .in("event_id", pastEventIds),
      ]);
      const confirmedPairs = new Set<string>();
      for (const r of regs ?? []) {
        confirmedPairs.add(`${r.user_id}:${r.event_id}`);
        confirmedByUser.set(r.user_id, (confirmedByUser.get(r.user_id) ?? 0) + 1);
      }
      for (const a of attends ?? []) {
        if (confirmedPairs.has(`${a.user_id}:${a.event_id}`)) {
          attendedByUser.set(a.user_id, (attendedByUser.get(a.user_id) ?? 0) + 1);
        }
      }
    }

    rows = members.map((member) => {
      const confirmed = confirmedByUser.get(member.id) ?? 0;
      const attended = attendedByUser.get(member.id) ?? 0;
      return {
        member,
        confirmed,
        attended,
        rate: confirmed > 0 ? attended / confirmed : null,
      };
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="출석 관리"
        description="활동 회원의 이벤트 출석률을 확인해요"
        action={<SendWarningButton />}
      />

      {rows.length === 0 ? (
        <EmptyState title="활동 회원이 없어요" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 font-medium">학번</th>
                <th className="px-4 py-3 font-medium">확정 신청</th>
                <th className="px-4 py-3 font-medium">출석</th>
                <th className="px-4 py-3 font-medium">출석률</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.member.id}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {row.member.name || "(이름 없음)"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.member.student_no || "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{row.confirmed}</td>
                  <td className="px-4 py-3 text-gray-700">{row.attended}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700">
                        {row.rate !== null
                          ? `${Math.round(row.rate * 100)}%`
                          : "-"}
                      </span>
                      {row.rate !== null &&
                        row.rate < ATTENDANCE_WARNING_THRESHOLD && (
                          <Badge tone="warning">경고</Badge>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
