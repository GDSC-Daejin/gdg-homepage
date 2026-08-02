import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { MonthFilter } from "@/components/MonthFilter";
import { formatKst, formatMonthLabel, monthKst } from "@/lib/format";
import { sumPointsInMonth } from "@/lib/points";
import type { Event, EventType, Group, Notice } from "@/lib/types";

const TYPE_LABELS: Record<EventType, string> = {
  session: "정기세션",
  study: "스터디",
  mogakco: "모각코",
  party: "파티",
};

const TYPE_TONES: Record<EventType, "primary" | "success" | "warning" | "danger"> = {
  session: "primary",
  study: "success",
  mogakco: "warning",
  party: "danger",
};

const GROUP_TYPE_LABELS = { study: "스터디", project: "프로젝트" } as const;
const GROUP_STATUS_LABELS = { recruiting: "모집중", active: "진행중", archived: "종료" } as const;

function CalendarIllustration() {
  return (
    <div
      aria-hidden
      className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft sm:h-36 sm:w-36"
    >
      <div className="absolute h-20 w-20 rounded-full bg-primary/15 sm:h-24 sm:w-24" />
      <svg
        viewBox="0 0 96 96"
        fill="none"
        className="relative h-20 w-20 text-primary sm:h-24 sm:w-24"
      >
        <rect x="22" y="25" width="52" height="48" rx="7" fill="white" />
        <path d="M22 34a7 7 0 0 1 7-7h38a7 7 0 0 1 7 7v9H22v-9Z" fill="currentColor" />
        <path d="M35 19v15M61 19v15" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <path d="M33 52h7M45 52h7M57 52h7M33 62h7M45 62h7" stroke="#D6E2FD" strokeWidth="6" strokeLinecap="round" />
        <circle cx="70" cy="67" r="13" fill="currentColor" />
        <path d="m64 67 4 4 8-9" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// 종료 시각이 없으면 시작 시각을 종료로 본다
function eventEnd(event: Event) {
  return new Date(event.ends_at ?? event.starts_at).getTime();
}

function isOngoing(event: Event) {
  const now = Date.now();
  return new Date(event.starts_at).getTime() <= now && now < eventEnd(event);
}

function EventCard({
  event,
  confirmed,
  featured = false,
}: {
  event: Event;
  confirmed: number;
  featured?: boolean;
}) {
  const ongoing = isOngoing(event);
  return (
    <Link
      href={`/events/${event.id}`}
      className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Card className="transition-shadow hover:shadow-md">
        {featured ? (
          <div className="flex items-center gap-5 sm:gap-7">
            <CalendarIllustration />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge tone={TYPE_TONES[event.type]}>{TYPE_LABELS[event.type]}</Badge>
                {ongoing && <Badge tone="success">진행중</Badge>}
              </div>
              <h3 className="mt-3 text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
                {event.title}
              </h3>
              <div className="mt-4 space-y-2 text-sm text-gray-500">
                <p className="flex items-center gap-2">
                  <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 shrink-0">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M7 3v4M17 3v4M3 10h18" />
                  </svg>
                  {formatKst(event.starts_at)}
                </p>
                {event.location && (
                  <p className="flex items-center gap-2">
                    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 shrink-0">
                      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                    {event.location}
                  </p>
                )}
                <p className="flex items-center gap-2">
                  <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 shrink-0">
                    <circle cx="9" cy="8" r="3" />
                    <path d="M3 20a6 6 0 0 1 12 0M16 11a3 3 0 0 1 0-6M18 20a5 5 0 0 0-2-4" />
                  </svg>
                  {confirmed}
                  {event.capacity ? ` / ${event.capacity}` : ""}명 신청
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Badge tone={TYPE_TONES[event.type]}>{TYPE_LABELS[event.type]}</Badge>
              {ongoing && <Badge tone="success">진행중</Badge>}
              <h3 className="text-base font-semibold text-gray-900">{event.title}</h3>
            </div>
            <p className="mt-2 text-sm text-gray-500">{formatKst(event.starts_at)}</p>
            {event.location && <p className="text-sm text-gray-500">{event.location}</p>}
            <p className="mt-3 text-xs text-gray-400">
              {confirmed}
              {event.capacity ? ` / ${event.capacity}` : ""}명 신청
            </p>
          </>
        )}
      </Card>
    </Link>
  );
}

export async function HomeDashboard({
  month,
  profileId,
}: {
  month?: string;
  profileId: string;
}) {
  const supabase = await createClient();

  // 서로 의존 없는 쿼리는 한 번에 병렬 실행 (서버 워터폴 제거)
  const [
    { data: latestNotice },
    { data: openSurveys },
    { data: myResponses },
    { data: pointLogs },
    { data: groupMembers },
    { data: events },
  ] = await Promise.all([
    supabase
      .from("notices")
      .select("id, title")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("surveys")
      .select("id, title")
      .eq("is_open", true)
      .order("created_at", { ascending: false }),
    supabase.from("survey_responses").select("survey_id").eq("user_id", profileId),
    supabase.from("point_logs").select("amount, created_at").eq("user_id", profileId),
    supabase.from("group_members").select("group_id").eq("user_id", profileId),
    supabase.from("events").select("*").order("starts_at", { ascending: false }),
  ]);

  const list = (events ?? []) as Event[];
  const groupIds = (groupMembers ?? []).map((member) => member.group_id);

  // 위 결과에 의존하는 두 쿼리도 서로 병렬 (groups ⇐ groupMembers, counts ⇐ events)
  const [groupsRes, countsRes] = await Promise.all([
    groupIds.length
      ? supabase.from("groups").select("id, type, title, status").in("id", groupIds)
      : Promise.resolve({ data: [] }),
    list.length
      ? supabase.rpc("event_confirmed_counts", { p_event_ids: list.map((e) => e.id) })
      : Promise.resolve({ data: [] }),
  ]);

  const myGroups = (groupsRes.data ?? []) as Pick<Group, "id" | "type" | "title" | "status">[];

  const counts: Record<string, number> = {};
  for (const row of (countsRes.data ?? []) as { event_id: string; confirmed: number }[]) {
    counts[row.event_id] = Number(row.confirmed);
  }

  const respondedIds = new Set((myResponses ?? []).map((response) => response.survey_id));
  const unanswered = (openSurveys ?? []).filter((survey) => !respondedIds.has(survey.id));
  const monthPoints = sumPointsInMonth(
    (pointLogs ?? []) as { amount: number; created_at: string }[],
    monthKst(new Date().toISOString()),
  );

  const now = Date.now();
  const upcoming = list.filter((e) => eventEnd(e) >= now).reverse();
  const allPast = list.filter((e) => eventEnd(e) < now);

  const pastMonths = Array.from(new Set(allPast.map((e) => monthKst(e.starts_at))));
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const past =
    month === "all"
      ? allPast
      : month
        ? allPast.filter((e) => monthKst(e.starts_at) === month)
        : allPast.filter((e) => new Date(e.starts_at) >= threeMonthsAgo);

  const monthOptions = [
    { value: "", label: "최근 3개월" },
    { value: "all", label: "전체" },
    ...pastMonths.map((m) => ({ value: m, label: formatMonthLabel(m) })),
  ];

  const notice = latestNotice as Pick<Notice, "id" | "title"> | null;

  return (
    <>
      {notice && (
        <Link
          href={`/notices/${notice.id}`}
          className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-card transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:bg-gray-100"
        >
          <Badge tone="primary">공지</Badge>
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
            {notice.title}
          </p>
          <span aria-hidden className="text-2xl leading-none text-gray-400 transition-transform group-hover:translate-x-0.5">
            ›
          </span>
        </Link>
      )}
      {unanswered.length > 0 && (
        <Link
          href="/surveys"
          className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-card transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning dark:bg-gray-100"
        >
          <Badge tone="warning">설문</Badge>
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
            응답을 기다리는 설문 {unanswered.length}개 — {unanswered[0].title}
          </p>
          <span aria-hidden className="text-2xl leading-none text-gray-400 transition-transform group-hover:translate-x-0.5">
            ›
          </span>
        </Link>
      )}

      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="text-xl font-bold tracking-tight text-gray-900">
            다가오는 이벤트
          </h2>
          {upcoming.length > 1 && (
            <span className="text-xs text-gray-500">
              {upcoming.length}개 예정
            </span>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)]">
          {upcoming.length === 0 ? (
            <EmptyState title="예정된 이벤트가 없어요" />
          ) : (
            <div className="flex flex-col gap-3">
              <EventCard
                event={upcoming[0]}
                confirmed={counts[upcoming[0].id] ?? 0}
                featured
              />
              {upcoming.length > 1 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {upcoming.slice(1).map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      confirmed={counts[event.id] ?? 0}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <Link
            href="/profile"
            className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Card className="relative flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
              <img
                src="/point-coin.png"
                alt=""
                className="absolute right-5 top-5 h-16 w-16 object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.2)]"
              />
              <p className="text-base font-medium text-gray-700">이번 달 포인트</p>
              <p className="mt-auto text-5xl font-bold tracking-tight text-primary">
                {monthPoints}<span className="ml-1 text-xl">P</span>
              </p>
              <p className="mt-8 flex items-center justify-between text-sm text-gray-500">
                프로필에서 내역 보기 <span aria-hidden className="text-2xl leading-none text-gray-400">›</span>
              </p>
            </Card>
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold tracking-tight text-gray-900">
            내 스터디·프로젝트
          </h2>
          {myGroups.length > 0 && <Badge tone="primary">{myGroups.length}개</Badge>}
        </div>
        <Card>
          {myGroups.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {myGroups.map((group) => (
                <div key={group.id} className="rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Badge tone={group.type === "study" ? "success" : "primary"}>
                      {GROUP_TYPE_LABELS[group.type]}
                    </Badge>
                    <span className="text-xs text-gray-500">{GROUP_STATUS_LABELS[group.status]}</span>
                  </div>
                  <p className="mt-2 truncate font-semibold text-gray-900">{group.title}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-gray-900">아직 참여 중인 스터디·프로젝트가 없어요</p>
                <p className="mt-1 text-sm text-gray-500">모집 중인 활동은 곧 목록에서 확인할 수 있어요.</p>
              </div>
              <button
                type="button"
                disabled
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                모집 중인 스터디·프로젝트 보기
              </button>
            </div>
          )}
        </Card>
      </section>

      <section>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-gray-900">
              지난 이벤트
            </h2>
          </div>
          <div>
            <MonthFilter
              options={monthOptions}
              value={month ?? ""}
              basePath="/"
            />
          </div>
        </div>
        {past.length === 0 ? (
          <EmptyState
            title="지난 이벤트가 없어요"
            description="참여했던 이벤트가 여기에 표시됩니다."
            icon={
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M7 3v4M17 3v4M3 10h18M8 14h8M8 17h5" />
              </svg>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {past.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                confirmed={counts[event.id] ?? 0}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export function HomeDashboardSkeleton() {
  const block = "animate-pulse rounded-xl bg-gray-100 dark:bg-gray-100";
  const heading = "mb-5 h-7 w-40 animate-pulse rounded bg-gray-100 dark:bg-gray-100";
  return (
    <>
      <div className={`h-14 ${block}`} />
      <section>
        <div className={heading} />
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)]">
          <div className={`h-44 ${block}`} />
          <div className={`h-44 ${block}`} />
        </div>
      </section>
      <section>
        <div className={heading} />
        <div className={`h-28 ${block}`} />
      </section>
    </>
  );
}
