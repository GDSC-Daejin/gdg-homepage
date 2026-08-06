import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { SectionTabs, MEMBER_TABS } from "../SectionTabs";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import type { Profile } from "@/lib/types";
import { displayName } from "@/lib/format";
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
        .in("role", ["member", "organizer", "team_member"])
        .eq("status", "active")
        .not("approved_at", "is", null)
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
      <SectionTabs tabs={MEMBER_TABS} label="회원" />
      <PageHeader
        title="출석 관리"
        description="활동 회원의 이벤트 출석률을 확인해요"
        action={<SendWarningButton />}
      />

      {rows.length === 0 ? (
        <EmptyState title="활동 회원이 없어요" />
      ) : (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-6">
            <h2 className="text-sm font-semibold text-gray-900">회원별 출석 현황</h2>
            <p className="text-sm text-gray-500">{rows.length}명</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">이름</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">학번</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">확정 신청</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">출석</th>
                  <th className="px-4 py-3 font-medium">출석률</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const name = displayName(row.member.name || "(이름 없음)", row.member.nickname);
                  return (
                    <tr
                      key={row.member.id}
                      className="border-b border-gray-100 last:border-0 transition-colors duration-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={row.member.name || name}
                            avatarPath={row.member.avatar_path}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary"
                          />
                          <Link href={`/admin/members/${row.member.id}`} className="font-medium text-primary hover:underline">
                            {name}
                          </Link>
                        </div>
                      </td>
                      <td className="hidden px-4 py-4 text-gray-700 md:table-cell">{row.member.student_no || "-"}</td>
                      <td className="hidden px-4 py-4 text-gray-700 lg:table-cell">{row.confirmed}</td>
                      <td className="hidden px-4 py-4 text-gray-700 lg:table-cell">{row.attended}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-700">{row.rate !== null ? `${Math.round(row.rate * 100)}%` : "-"}</span>
                          {row.rate !== null && row.rate < ATTENDANCE_WARNING_THRESHOLD && <Badge tone="warning">경고</Badge>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
