import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { formatKst } from "@/lib/format";
import type { EventType, Survey, RecruitingSettings, ApplicationStatus, Position } from "@/lib/types";
import { isDemoMode } from "@/lib/demo";
import { getRecruitingSettings, isRecruitingOpen } from "@/lib/recruiting";
import { OverviewTabs } from "./OverviewTabs";
import { RecruitingWidget } from "./RecruitingWidget";
import { SyncMeetingsButton } from "./SyncMeetingsButton";
import {
  DEMO_DASHBOARD_STATS,
  DEMO_DASHBOARD_ROWS,
  DEMO_DASHBOARD_JOIN_COUNTS,
  DEMO_DASHBOARD_SATISFACTION,
  DEMO_DASHBOARD_RANKING,
} from "@/lib/demoData";

const EVENT_TYPE_LABEL: Record<EventType, string> = {
  session: "정기세션",
  study: "스터디",
  mogakco: "모각코",
  party: "파티",
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

interface RecruitingCounts {
  total: number;
  waiting: number;
  pending: number;
  accepted: number;
  rejected: number;
  frontend: number;
  backend: number;
  designer: number;
  beginner: number;
  unassigned: number;
}

// demo(둘러보기) 모드 전용 인라인 상수 — demoData.ts는 수정하지 않는다
const DEMO_RECRUITING_SETTINGS: RecruitingSettings = {
  season: "2026-2",
  is_open: true,
  open_positions: ["frontend", "backend", "designer", "beginner"],
  apply_start: null,
  apply_end: null,
};

const DEMO_RECRUITING_COUNTS: RecruitingCounts = {
  total: 12,
  waiting: 5,
  pending: 3,
  accepted: 3,
  rejected: 1,
  frontend: 4,
  backend: 5,
  designer: 2,
  beginner: 0,
  unassigned: 1,
};

const DEMO_RECRUITING_TODAY_EVENTS: { id: string; title: string; starts_at: string }[] = [
  { id: "demo-re1", title: "리크루팅 설명회", starts_at: "2026-01-01T09:00:00.000Z" },
];

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const demo = await isDemoMode();

  let totalMembers = DEMO_DASHBOARD_STATS.totalMembers;
  let activeMembers = DEMO_DASHBOARD_STATS.activeMembers;
  let upcomingEvents = DEMO_DASHBOARD_STATS.upcomingEvents;
  let rows: RecentEventRow[] = DEMO_DASHBOARD_ROWS;
  let joinCounts: number[] = DEMO_DASHBOARD_JOIN_COUNTS;
  let satisfactionRows: {
    id: string;
    surveyId: string | null;
    title: string;
    count: number;
    avg: number;
  }[] = DEMO_DASHBOARD_SATISFACTION;
  let rankingRows: { rank: number; id: string; name: string; total: number }[] =
    DEMO_DASHBOARD_RANKING;
  let recruitingSettings: RecruitingSettings = DEMO_RECRUITING_SETTINGS;
  let recruitingCounts: RecruitingCounts = DEMO_RECRUITING_COUNTS;
  let recruitingTodayEvents: { id: string; title: string; starts_at: string }[] =
    DEMO_RECRUITING_TODAY_EVENTS;

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
        .select("*", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
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

    // 월별 신규 가입 추이 (최근 6개월)
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

    // 세션별 만족도 (설문 rating 질문 평균)
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
    const surveyIdByEventId = new Map<string, string>();
    for (const survey of eventSurveys) {
      if (survey.event_id && !surveyIdByEventId.has(survey.event_id)) {
        surveyIdByEventId.set(survey.event_id, survey.id);
      }
    }
    satisfactionRows = eventIdsWithSurvey
      .map((id) => ({
        id,
        surveyId: surveyIdByEventId.get(id) ?? null,
        title: eventTitleById.get(id) ?? "(삭제된 이벤트)",
        count: ratingCountByEvent.get(id) ?? 0,
        avg:
          ratingCountByEvent.get(id) && ratingCountByEvent.get(id)! > 0
            ? (ratingSumByEvent.get(id) ?? 0) / ratingCountByEvent.get(id)!
            : 0,
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.avg - a.avg);

    // 활동 랭킹 Top 10 (포인트 합산)
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

    // 리크루팅 위젯
    recruitingSettings = await getRecruitingSettings();
    if (recruitingSettings.is_open) {
      const { data: applicationRows } = await supabase
        .from("applications")
        .select("status, position")
        .eq("season", recruitingSettings.season);
      const apps =
        (applicationRows as { status: ApplicationStatus; position: Position | null }[] | null) ??
        [];
      recruitingCounts = {
        total: apps.length,
        waiting: apps.filter((a) => a.status === "waiting").length,
        pending: apps.filter((a) => a.status === "pending").length,
        accepted: apps.filter((a) => a.status === "accepted").length,
        rejected: apps.filter((a) => a.status === "rejected").length,
        frontend: apps.filter((a) => a.position === "frontend").length,
        backend: apps.filter((a) => a.position === "backend").length,
        designer: apps.filter((a) => a.position === "designer").length,
        beginner: apps.filter((a) => a.position === "beginner").length,
        unassigned: apps.filter((a) => a.position === null).length,
      };

      // 오늘(KST) 00:00~24:00 사이 시작하는 이벤트
      const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const todayStartUtc = new Date(
        Date.UTC(
          kstNow.getUTCFullYear(),
          kstNow.getUTCMonth(),
          kstNow.getUTCDate(),
        ) -
          9 * 60 * 60 * 1000,
      );
      const todayEndUtc = new Date(todayStartUtc.getTime() + 24 * 60 * 60 * 1000);
      const { data: todayEventRows } = await supabase
        .from("events")
        .select("id, title, starts_at")
        .gte("starts_at", todayStartUtc.toISOString())
        .lt("starts_at", todayEndUtc.toISOString());
      recruitingTodayEvents =
        (todayEventRows as { id: string; title: string; starts_at: string }[] | null) ?? [];
    }
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
      <OverviewTabs />
      <PageHeader title="대시보드" description="동아리 현황을 한눈에 확인해요" />

      <Card>
        <p className="mb-3 text-sm font-semibold text-gray-900">운영 도구</p>
        <SyncMeetingsButton />
      </Card>

      {recruitingSettings.is_open && (
        <RecruitingWidget
          season={recruitingSettings.season}
          open={isRecruitingOpen(recruitingSettings)}
          counts={recruitingCounts}
          todayEvents={recruitingTodayEvents}
        />
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
                    {formatKst(row.starts_at)}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <p className="mb-4 text-sm font-semibold text-gray-900">
            월별 신규 가입 추이
          </p>
          <div className="flex h-32 items-end gap-3">
            {months.map((m) => {
              const count = joinCountByMonth.get(m.key) ?? 0;
              const height = Math.max(4, (count / maxJoinCount) * 100);
              return (
                <div
                  key={m.key}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <span className="text-xs font-medium text-gray-700">
                    {count}
                  </span>
                  <div className="flex h-24 w-full items-end">
                    <div
                      className="w-full rounded-t-sm bg-primary"
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
          <p className="mb-4 text-sm font-semibold text-gray-900">
            세션별 만족도
          </p>
          {satisfactionRows.length === 0 ? (
            <EmptyState title="설문 응답 데이터가 없어요" />
          ) : (
            <div className="flex flex-col gap-3">
              {satisfactionRows.map((r) => {
                const content = (
                  <>
                    <span className="w-24 shrink-0 truncate text-sm text-gray-700">
                      {r.title}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(r.avg / 5) * 100}%` }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs text-gray-500">
                      {r.avg.toFixed(1)}점 ({r.count})
                    </span>
                  </>
                );
                return r.surveyId ? (
                  <Link
                    key={r.id}
                    href={`/admin/surveys/${r.surveyId}/results`}
                    className="flex items-center gap-3 rounded-md hover:bg-gray-50"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={r.id} className="flex items-center gap-3">
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <div className="border-b border-gray-200 px-4 py-3">
          <p className="text-sm font-semibold text-gray-900">
            활동 랭킹 Top 10
          </p>
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
                <th className="px-4 py-3 font-medium">포인트</th>
              </tr>
            </thead>
            <tbody>
              {rankingRows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {r.rank}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.name}</td>
                  <td className="px-4 py-3 text-gray-700">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
