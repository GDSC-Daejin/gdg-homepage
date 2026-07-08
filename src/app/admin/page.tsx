import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import type { EventType } from "@/lib/types";

const EVENT_TYPE_LABEL: Record<EventType, string> = {
  session: "세션",
  study: "스터디",
  devfest: "데브페스트",
};

interface RecentEventRow {
  id: string;
  title: string;
  type: EventType;
  starts_at: string;
  confirmed: number;
  attended: number;
  rate: number | null;
}

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const [
    { count: totalMembers },
    { count: activeMembers },
    { count: upcomingEvents },
    { data: recentEventsData },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "member"),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "member")
      .eq("status", "active"),
    supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .gte("starts_at", now),
    supabase
      .from("events")
      .select("id, title, type, starts_at")
      .lt("starts_at", now)
      .order("starts_at", { ascending: false })
      .limit(5),
  ]);

  const recentEvents = recentEventsData ?? [];
  const recentEventIds = recentEvents.map((e) => e.id);

  const confirmedByEvent = new Map<string, number>();
  const attendedByEvent = new Map<string, number>();

  if (recentEventIds.length > 0) {
    const [{ data: regs }, { data: attends }] = await Promise.all([
      supabase
        .from("event_registrations")
        .select("user_id, event_id")
        .eq("status", "confirmed")
        .in("event_id", recentEventIds),
      supabase
        .from("attendances")
        .select("user_id, event_id")
        .in("event_id", recentEventIds),
    ]);
    const confirmedPairs = new Set<string>();
    for (const r of regs ?? []) {
      confirmedPairs.add(`${r.user_id}:${r.event_id}`);
      confirmedByEvent.set(
        r.event_id,
        (confirmedByEvent.get(r.event_id) ?? 0) + 1,
      );
    }
    for (const a of attends ?? []) {
      if (confirmedPairs.has(`${a.user_id}:${a.event_id}`)) {
        attendedByEvent.set(
          a.event_id,
          (attendedByEvent.get(a.event_id) ?? 0) + 1,
        );
      }
    }
  }

  const rows: RecentEventRow[] = recentEvents.map((e) => {
    const confirmed = confirmedByEvent.get(e.id) ?? 0;
    const attended = attendedByEvent.get(e.id) ?? 0;
    return {
      id: e.id,
      title: e.title,
      type: e.type,
      starts_at: e.starts_at,
      confirmed,
      attended,
      rate: confirmed > 0 ? attended / confirmed : null,
    };
  });

  const ratedRows = rows.filter((r) => r.rate !== null);
  const avgRate =
    ratedRows.length > 0
      ? ratedRows.reduce((sum, r) => sum + (r.rate ?? 0), 0) /
        ratedRows.length
      : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="대시보드" description="동아리 현황을 한눈에 확인해요" />

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="전체 회원 수" value={totalMembers ?? 0} />
        <StatCard label="활동 회원 수" value={activeMembers ?? 0} />
        <StatCard label="다가오는 이벤트 수" value={upcomingEvents ?? 0} />
        <StatCard
          label="최근 이벤트 평균 출석률"
          value={avgRate !== null ? `${Math.round(avgRate * 100)}%` : "-"}
          hint="최근 지난 이벤트 5개 기준"
        />
      </div>

      <Card className="overflow-x-auto p-0">
        <div className="border-b border-gray-200 px-4 py-3">
          <p className="text-sm font-semibold text-gray-900">최근 이벤트</p>
        </div>
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState title="지난 이벤트가 없어요" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">제목</th>
                <th className="px-4 py-3 font-medium">유형</th>
                <th className="px-4 py-3 font-medium">일시</th>
                <th className="px-4 py-3 font-medium">확정 인원</th>
                <th className="px-4 py-3 font-medium">출석 인원</th>
                <th className="px-4 py-3 font-medium">출석률</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {row.title}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {EVENT_TYPE_LABEL[row.type]}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(row.starts_at).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{row.confirmed}</td>
                  <td className="px-4 py-3 text-gray-700">{row.attended}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.rate !== null ? `${Math.round(row.rate * 100)}%` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
