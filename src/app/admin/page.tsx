import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { formatKst } from "@/lib/format";
import type { EventType, Survey } from "@/lib/types";
import { isDemoMode } from "@/lib/demo";
import {
  DEMO_DASHBOARD_STATS,
  DEMO_DASHBOARD_ROWS,
  DEMO_DASHBOARD_JOIN_COUNTS,
  DEMO_DASHBOARD_SATISFACTION,
  DEMO_DASHBOARD_RANKING,
} from "@/lib/demoData";

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
  const demo = await isDemoMode();

  let totalMembers = DEMO_DASHBOARD_STATS.totalMembers;
  let activeMembers = DEMO_DASHBOARD_STATS.activeMembers;
  let upcomingEvents = DEMO_DASHBOARD_STATS.upcomingEvents;
  let rows: RecentEventRow[] = DEMO_DASHBOARD_ROWS;
  let joinCounts: number[] = DEMO_DASHBOARD_JOIN_COUNTS;
  let satisfactionRows: { id: string; title: string; count: number; avg: number }[] =
    DEMO_DASHBOARD_SATISFACTION;
  let rankingRows: { rank: number; id: string; name: string; total: number }[] =
    DEMO_DASHBOARD_RANKING;

  if (!demo) {
    const supabase = await createClient();
    const now = new Date().toISOString();

    const [
      { count: totalMembersCount },
      { count: activeMembersCount },
      { count: upcomingEventsCount },
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

    totalMembers = totalMembersCount ?? 0;
    activeMembers = activeMembersCount ?? 0;
    upcomingEvents = upcomingEventsCount ?? 0;

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

    rows = recentEvents.map((e) => {
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

    const nowDate = new Date();
    const sinceDate = new Date(
      nowDate.getFullYear(),
      nowDate.getMonth() - 5,
      1,
    ).toISOString();
    const { data: joinRows } = await supabase
      .from("profiles")
      .select("joined_at")
      .gte("joined_at", sinceDate);

    const monthKeys = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - (5 - i), 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    const joinCountByMonthReal = new Map(monthKeys.map((k) => [k, 0]));
    for (const row of joinRows ?? []) {
      const d = new Date(row.joined_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (joinCountByMonthReal.has(key)) {
        joinCountByMonthReal.set(key, (joinCountByMonthReal.get(key) ?? 0) + 1);
      }
    }
    joinCounts = monthKeys.map((k) => joinCountByMonthReal.get(k) ?? 0);

    const { data: eventSurveysData } = await supabase
      .from("surveys")
      .select("id, title, event_id, questions")
      .not("event_id", "is", null);
    const eventSurveys = (eventSurveysData ?? []) as Survey[];
    const surveyIds = eventSurveys.map((s) => s.id);

    const { data: surveyResponsesData } =
      surveyIds.length > 0
        ? await supabase
            .from("survey_responses")
            .select("survey_id, answers")
            .in("survey_id", surveyIds)
        : { data: [] as { survey_id: string; answers: Record<string, unknown> }[] };
    const surveyResponses =
      (surveyResponsesData as { survey_id: string; answers: Record<string, unknown> }[]) ?? [];

    const eventIdsWithSurvey = Array.from(
      new Set(eventSurveys.map((s) => s.event_id).filter((id): id is string => !!id)),
    );
    const { data: satisfactionEventsData } =
      eventIdsWithSurvey.length > 0
        ? await supabase.from("events").select("id, title").in("id", eventIdsWithSurvey)
        : { data: [] as { id: string; title: string }[] };
    const eventTitleById = new Map(
      ((satisfactionEventsData as { id: string; title: string }[] | null) ?? []).map((e) => [
        e.id,
        e.title,
      ]),
    );

    const ratingSumByEvent = new Map<string, number>();
    const ratingCountByEvent = new Map<string, number>();
    for (const survey of eventSurveys) {
      if (!survey.event_id) continue;
      const ratingQids = survey.questions
        .filter((q) => q.type === "rating")
        .map((q) => q.id);
      if (ratingQids.length === 0) continue;

      const responsesForSurvey = surveyResponses.filter(
        (r) => r.survey_id === survey.id,
      );
      for (const r of responsesForSurvey) {
        for (const qid of ratingQids) {
          const raw = r.answers[qid];
          if (raw === undefined || raw === "") continue;
          const n = Number(raw);
          if (Number.isNaN(n)) continue;
          ratingSumByEvent.set(
            survey.event_id,
            (ratingSumByEvent.get(survey.event_id) ?? 0) + n,
          );
          ratingCountByEvent.set(
            survey.event_id,
            (ratingCountByEvent.get(survey.event_id) ?? 0) + 1,
          );
        }
      }
    }
    satisfactionRows = eventIdsWithSurvey
      .map((id) => ({
        id,
        title: eventTitleById.get(id) ?? "(삭제된 이벤트)",
        count: ratingCountByEvent.get(id) ?? 0,
        avg:
          ratingCountByEvent.get(id) && ratingCountByEvent.get(id)! > 0
            ? (ratingSumByEvent.get(id) ?? 0) / ratingCountByEvent.get(id)!
            : 0,
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.avg - a.avg);

    const { data: pointRows } = await supabase
      .from("point_logs")
      .select("user_id, amount");
    const pointSumByUser = new Map<string, number>();
    for (const p of (pointRows as { user_id: string; amount: number }[] | null) ?? []) {
      pointSumByUser.set(p.user_id, (pointSumByUser.get(p.user_id) ?? 0) + p.amount);
    }
    const topUsers = Array.from(pointSumByUser.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const topUserIds = topUsers.map(([id]) => id);
    const { data: topProfilesData } =
      topUserIds.length > 0
        ? await supabase.from("profiles").select("id, name").in("id", topUserIds)
        : { data: [] as { id: string; name: string }[] };
    const topNameById = new Map(
      ((topProfilesData as { id: string; name: string }[] | null) ?? []).map((p) => [
        p.id,
        p.name,
      ]),
    );
    rankingRows = topUsers.map(([id, total], i) => ({
      rank: i + 1,
      id,
      name: topNameById.get(id) ?? "(탈퇴)",
      total,
    }));
  }

  const ratedRows = rows.filter((r) => r.rate !== null);
  const avgRate =
    ratedRows.length > 0
      ? ratedRows.reduce((sum, r) => sum + (r.rate ?? 0), 0) /
        ratedRows.length
      : null;

  const nowDate = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${d.getMonth() + 1}월`,
    };
  });
  const joinCountByMonth = new Map(months.map((m, i) => [m.key, joinCounts[i] ?? 0]));
  const maxJoinCount = Math.max(1, ...joinCountByMonth.values());

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="대시보드" description="동아리 현황을 한눈에 확인해요" />

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="전체 회원 수" value={totalMembers ?? 0} hint="role = member" />
        <StatCard label="활동 회원 수" value={activeMembers ?? 0} hint="status = active" />
        <StatCard
          label="다가오는 이벤트 수"
          value={upcomingEvents ?? 0}
          hint="시작일 기준 미래"
        />
        <StatCard
          label="최근 이벤트 평균 출석률"
          value={avgRate !== null ? `${Math.round(avgRate * 100)}%` : "-"}
          hint="최근 지난 이벤트 5개 기준"
          emphasis
        />
      </div>

      <Card className="overflow-x-auto p-0">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <p className="text-sm font-semibold text-gray-900">최근 이벤트</p>
          <p className="text-xs text-gray-400">최근 종료일 순</p>
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
                <th className="px-4 py-3 font-medium">일시 (KST)</th>
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
                  <td className="px-4 py-3 text-gray-500">
                    {EVENT_TYPE_LABEL[row.type]}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatKst(row.starts_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{row.confirmed}</td>
                  <td className="px-4 py-3 text-gray-700">{row.attended}</td>
                  <td className="px-4 py-3 font-semibold text-primary">
                    {row.rate !== null ? `${Math.round(row.rate * 100)}%` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <p className="text-sm font-semibold text-gray-900">월별 신규 가입 추이</p>
          <p className="mb-4 text-xs text-gray-400">최근 6개월</p>
          <div className="flex h-32 items-end gap-3">
            {months.map((m, i) => {
              const count = joinCountByMonth.get(m.key) ?? 0;
              const height = Math.max(4, (count / maxJoinCount) * 100);
              const isCurrent = i === months.length - 1;
              return (
                <div
                  key={m.key}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <span
                    className={`text-xs font-medium ${isCurrent ? "text-primary" : "text-gray-700"}`}
                  >
                    {count}
                  </span>
                  <div className="flex h-24 w-full items-end">
                    <div
                      className={`w-full rounded-t-sm ${isCurrent ? "bg-primary" : "bg-gray-200"}`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{m.label}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <p className="text-sm font-semibold text-gray-900">세션별 만족도</p>
          <p className="mb-4 text-xs text-gray-400">설문 평점 평균 · 높은 순</p>
          {satisfactionRows.length === 0 ? (
            <EmptyState title="설문 응답 데이터가 없어요" />
          ) : (
            <div className="flex flex-col gap-3">
              {satisfactionRows.map((r) => (
                <div key={r.id} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-sm text-gray-700">
                    {r.title}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(r.avg / 5) * 100}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs font-medium text-gray-500">
                    {r.avg.toFixed(1)} · {r.count}명
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <p className="text-sm font-semibold text-gray-900">
            활동 랭킹 Top 10
          </p>
          <p className="text-xs text-gray-400">누적 포인트 기준</p>
        </div>
        {rankingRows.length === 0 ? (
          <div className="p-6">
            <EmptyState title="포인트 내역이 없어요" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">순위</th>
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 text-right font-medium">누적 포인트</th>
              </tr>
            </thead>
            <tbody>
              {rankingRows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">
                    {r.rank <= 3 ? (
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${
                          r.rank === 1
                            ? "bg-primary text-white"
                            : "bg-primary-soft text-primary"
                        }`}
                      >
                        {r.rank}
                      </span>
                    ) : (
                      <span className="pl-1 text-gray-400">{r.rank}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.name}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {r.total.toLocaleString()}
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
