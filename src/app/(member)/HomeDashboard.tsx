import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MonthFilter } from "@/components/MonthFilter";
import {
  dayKeyKst,
  formatKstTime,
  formatMonthLabel,
  formatRelativeKst,
  monthKst,
} from "@/lib/format";
import { splitPointsInMonth } from "@/lib/points";
import { homeTodos, type HomeTodo } from "@/lib/home-todos";
import { isDemoMode } from "@/lib/demo";
import {
  DEMO_EVENT_CONFIRMED_COUNTS,
  DEMO_EVENTS,
  DEMO_GROUP_MEMBERS,
  DEMO_GROUPS,
  DEMO_NOTICES,
  DEMO_POINT_LOGS,
  DEMO_SURVEYS,
} from "@/lib/demoData";
import type { Event, EventType, Group, Notice } from "@/lib/types";
import styles from "./home.module.css";

const TYPE_LABELS: Record<EventType, string> = {
  session: "정기세션",
  study: "스터디",
  mogakco: "모각코",
  party: "파티",
};

const GROUP_TYPE_LABELS = { study: "스터디", project: "프로젝트" } as const;
const GROUP_STATUS_LABELS = { recruiting: "모집중", active: "진행중", archived: "종료" } as const;

// 종료 시각이 없으면 시작 시각을 종료로 본다
function eventEnd(event: Event) {
  if (!event.event_date || !event.starts_at) return Number.POSITIVE_INFINITY;
  return new Date(event.ends_at ?? event.starts_at).getTime();
}

export function upcomingEvents(events: Event[], now = Date.now()) {
  return events
    .filter((event) => eventEnd(event) >= now)
    .sort((a, b) => {
      const aDate = a.event_date ?? (a.starts_at ? dayKeyKst(a.starts_at) : "9999-12-31");
      const bDate = b.event_date ?? (b.starts_at ? dayKeyKst(b.starts_at) : "9999-12-31");
      return aDate.localeCompare(bDate) || (a.starts_at ?? "").localeCompare(b.starts_at ?? "");
    });
}

/** "7/23" — 지난 이벤트 줄용 짧은 표기 */
function shortDate(iso: string) {
  const [, m, d] = dayKeyKst(iso).split("-");
  return `${Number(m)}/${d}`;
}

/** 시작까지 남은 일수 라벨. 이미 시작했으면 "진행 중". */
function dDay(event: Event) {
  if (!event.event_date || !event.starts_at) return "일시 미정";
  const now = Date.now();
  const start = new Date(event.starts_at).getTime();
  if (start <= now) return now < eventEnd(event) ? "진행 중" : null;
  const days = Math.ceil((start - now) / 86_400_000);
  return days === 0 ? "D-DAY" : `D-${days}`;
}

/** "10월 30일(목) 오후 7:00" */
function todoWhen(event: Event) {
  const date = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
  }).format(new Date(event.starts_at));
  const weekday = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" }).format(
    new Date(event.starts_at),
  );
  return `${date}(${weekday}) ${formatKstTime(event.starts_at)}`;
}

/** 날짜 배지용 [월, 일] (KST) */
function monthDay(iso: string) {
  const [, m, d] = dayKeyKst(iso).split("-");
  return [`${Number(m)}월`, String(Number(d))] as const;
}

/** "2일 전" — 하루 안쪽은 "3시간 전"처럼 */
function daysAgo(iso: string, now: number) {
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  return days < 1 ? formatRelativeKst(iso) : `${days}일 전`;
}

function signedPoints(value: number, sign: "+" | "−") {
  return value === 0 ? "0P" : `${sign}${value.toLocaleString("ko-KR")}P`;
}

function SurveyIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
      <path d="M9 4h6M8 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
      <path d="M8 12l2.5 2.5L16 9" />
    </svg>
  );
}

function NoticeIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
      <path d="M4 10v4h3l6 4V6L7 10H4Z" />
      <path d="M17 9a4 4 0 0 1 0 6" />
    </svg>
  );
}

export async function HomeDashboard({
  month,
  nickname,
  profileId,
}: {
  month?: string;
  nickname: string;
  profileId: string;
}) {
  const demo = await isDemoMode();
  let list: Event[];
  let myGroups: Pick<Group, "id" | "type" | "title" | "status">[];
  let counts: Record<string, number>;
  let respondedIds: Set<string>;
  let openSurveys: { id: string; title: string }[] | undefined;
  let logs: { amount: number; created_at: string }[];
  let notices: Pick<Notice, "id" | "title" | "published_at">[];
  let registeredEventIds: Set<string>;

  if (demo) {
    list = DEMO_EVENTS;
    myGroups = DEMO_GROUPS.filter((group) => DEMO_GROUP_MEMBERS.some((member) => member.user_id === profileId && member.group_id === group.id));
    counts = { ...DEMO_EVENT_CONFIRMED_COUNTS };
    respondedIds = new Set(["demo-s1"]);
    openSurveys = DEMO_SURVEYS.filter((survey) => survey.is_open);
    logs = DEMO_POINT_LOGS.filter((log) => log.user_id === profileId);
    notices = DEMO_NOTICES.filter((notice) => notice.published).slice(0, 3);
    registeredEventIds = new Set();
  } else {
    const supabase = await createClient();
    const [
      { data: noticeRows },
      { data: queriedOpenSurveys },
      { data: myResponses },
      { data: pointLogs },
      { data: groupMembers },
      { data: events },
      { data: myRegistrations },
    ] = await Promise.all([
      supabase.from("notices").select("id, title, published_at").eq("published", true).order("published_at", { ascending: false }).limit(3),
      supabase.from("surveys").select("id, title").eq("is_open", true).order("created_at", { ascending: false }),
      supabase.from("survey_responses").select("survey_id").eq("user_id", profileId),
      supabase.from("point_logs").select("amount, created_at").eq("user_id", profileId),
      supabase.from("group_members").select("group_id").eq("user_id", profileId),
      supabase.from("events").select("id, type, title, starts_at, ends_at, event_date, location, capacity").order("starts_at", { ascending: false }),
      supabase.from("event_registrations").select("event_id").eq("user_id", profileId),
    ]);
    list = (events ?? []) as Event[];
    const groupIds = (groupMembers ?? []).map((member) => member.group_id);
    const [groupsRes, countsRes] = await Promise.all([
      groupIds.length ? supabase.from("groups").select("id, type, title, status").in("id", groupIds) : Promise.resolve({ data: [] }),
      list.length ? supabase.rpc("event_confirmed_counts", { p_event_ids: list.map((event) => event.id) }) : Promise.resolve({ data: [] }),
    ]);
    myGroups = (groupsRes.data ?? []) as Pick<Group, "id" | "type" | "title" | "status">[];
    counts = {};
    for (const row of (countsRes.data ?? []) as { event_id: string; confirmed: number }[]) counts[row.event_id] = Number(row.confirmed);
    respondedIds = new Set((myResponses ?? []).map((response) => response.survey_id));
    openSurveys = queriedOpenSurveys ?? undefined;
    logs = (pointLogs ?? []) as { amount: number; created_at: string }[];
    notices = (noticeRows ?? []) as Pick<Notice, "id" | "title" | "published_at">[];
    registeredEventIds = new Set((myRegistrations ?? []).map((registration) => registration.event_id));
  }

  const latestSurvey = (openSurveys ?? [])[0];
  const latestNotice = notices[0];

  const now = Date.now();
  const { earned, spent } = splitPointsInMonth(logs, monthKst(new Date(now).toISOString()));
  const totalPoints = logs.reduce((sum, log) => sum + log.amount, 0);

  const todos = homeTodos({
    events: list,
    registeredEventIds,
    openSurveys: openSurveys ?? [],
    respondedSurveyIds: respondedIds,
    notices,
    now,
  });
  const allSurveysAnswered = (openSurveys ?? []).length > 0 && (openSurveys ?? []).every((survey) => respondedIds.has(survey.id));

  const allPast = list.filter((e) => e.event_date && eventEnd(e) < now);

  const pastMonths = Array.from(new Set(allPast.map((e) => monthKst(e.starts_at))));
  const threeMonthsAgo = new Date(now);
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

  return (
    <div className={`wds-surface ${styles.home}`}>
      <header>
        <h1 className={styles.greeting}>안녕하세요, {nickname}</h1>
        <p className={styles.sub}>
          {todos.length > 0 ? `확인할 일이 ${todos.length}개 있어요.` : "지금은 따로 챙길 일이 없어요."}
        </p>
      </header>

      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="home-todo">
          <div className={`${styles.cardHead} ${styles.cardHeadTodo}`}>
            <h2 id="home-todo" className={styles.cardTitle}>다음에 할 일</h2>
          </div>
          {todos.length === 0 ? (
            <div className={styles.todoEmpty}>
              <p className={styles.todoEmptyTitle}>지금은 할 일이 없어요</p>
              <p className={styles.muted}>
                새 이벤트·설문·공지가 올라오면 여기에 모아서 보여 드려요.
                {allSurveysAnswered && " 열린 설문 응답은 모두 마쳤어요."}
              </p>
            </div>
          ) : (
            todos.map((todo) => <TodoRow key={`${todo.kind}-${todoId(todo)}`} todo={todo} counts={counts} now={now} />)
          )}
        </section>

        <div className={styles.col}>
          <section className={styles.card} aria-labelledby="home-points">
            <div className={styles.cardHead}>
              <h2 id="home-points" className={styles.cardTitle}>내 포인트</h2>
              <Link href="/profile" className={styles.more}>내역 보기</Link>
            </div>
            <div className={styles.points}>
              <div className={styles.pointsTotal}>
                {totalPoints.toLocaleString("ko-KR")}
                <span className={styles.pointsUnit}>P 보유</span>
              </div>
              <dl className={styles.pointsMonth}>
                <div>
                  <dt className={styles.muted}>이번 달 획득</dt>
                  <dd>{signedPoints(earned, "+")}</dd>
                </div>
                <div>
                  <dt className={styles.muted}>이번 달 사용</dt>
                  <dd>{signedPoints(spent, "−")}</dd>
                </div>
              </dl>
              {/* 둘러보기에서는 포켓몬 메뉴처럼 상점도 막혀 있어 링크를 숨긴다 */}
              {!demo && (
                <Link href="/store" className={`${styles.btn} ${styles.btnSecondary}`}>
                  상점 가기
                </Link>
              )}
            </div>
          </section>

          <section className={styles.card} aria-labelledby="home-groups">
            <div className={styles.cardHead}>
              <h2 id="home-groups" className={styles.cardTitle}>내 스터디·프로젝트</h2>
              {myGroups.length > 0 && <span className={styles.cardMeta}>{myGroups.length}개</span>}
            </div>
            {myGroups.length === 0 ? (
              <div className={styles.groupsEmpty}>
                <p className={styles.groupsEmptyTitle}>아직 참여 중인 활동이 없어요</p>
                <p className={styles.muted}>모집 중인 활동은 곧 목록에서 확인할 수 있어요.</p>
                <span className={styles.tag}>목록 준비 중</span>
              </div>
            ) : (
              myGroups.map((group) => (
                <div key={group.id} className={styles.groupRow}>
                  <span
                    className={`${styles.groupBar} ${group.status === "active" ? "" : styles.groupBarMuted}`}
                  />
                  <div className={styles.groupInfo}>
                    <div className={styles.groupTitle}>{group.title}</div>
                    <div className={styles.groupSub}>{GROUP_TYPE_LABELS[group.type]}</div>
                  </div>
                  <span className={styles.groupStatus}>{GROUP_STATUS_LABELS[group.status]}</span>
                </div>
              ))
            )}
          </section>
        </div>
      </div>

      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="home-past">
          <div className={styles.cardHead}>
            <h2 id="home-past" className={styles.cardTitle}>지난 이벤트</h2>
            <MonthFilter options={monthOptions} value={month ?? ""} basePath="/" />
          </div>
          {past.length === 0 ? (
            <p className={styles.empty}>지난 이벤트가 없어요.</p>
          ) : (
            <div className={styles.rows}>
              {past.map((event) => (
                <Link key={event.id} href={`/events/${event.id}`} className={styles.row}>
                  <span className={styles.pastDate}>{shortDate(event.starts_at)}</span>
                  <span className={styles.pastTitle}>
                    <span className={styles.pastName}>{event.title}</span>
                    {event.location && <span className={styles.pastPlace}>{event.location}</span>}
                  </span>
                  <span className={styles.muted}>
                    {counts[event.id] ?? 0}
                    {event.capacity ? `/${event.capacity}` : ""}명
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className={styles.card} aria-labelledby="home-shortcuts">
          <div className={styles.cardHead}>
            <h2 id="home-shortcuts" className={styles.cardTitle}>바로 가기</h2>
          </div>
          <div className={styles.rows}>
            <Link href="/notices" className={styles.row}>
              <span className={styles.tag}>공지</span>
              <span className={styles.rowTitle}>{latestNotice ? latestNotice.title : "등록된 공지가 없어요"}</span>
              <span className={styles.muted}>전체 →</span>
            </Link>
            {latestSurvey ? (
              <Link href={`/surveys/${latestSurvey.id}`} className={styles.row}>
                <span className={styles.tag}>설문</span>
                <span className={styles.rowTitle}>{latestSurvey.title}</span>
                <span className={styles.muted}>{respondedIds.has(latestSurvey.id) ? "응답 완료" : "응답하기"}</span>
              </Link>
            ) : (
              <Link href="/surveys" className={styles.row}>
                <span className={styles.tag}>설문</span>
                <span className={styles.rowTitle}>열린 설문이 없어요</span>
                <span className={styles.muted}>전체 →</span>
              </Link>
            )}
            <Link href="/squirtle" className={styles.row}>
              <span className={styles.tag}>꼬북봇</span>
              <span className={styles.rowTitle}>함께 키운 꼬북이 기록</span>
              <span className={styles.muted}>지난 시즌 →</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function todoId(todo: HomeTodo) {
  if (todo.kind === "event") return todo.event.id;
  if (todo.kind === "survey") return todo.survey.id;
  return todo.notice.id;
}

function TodoRow({ todo, counts, now }: { todo: HomeTodo; counts: Record<string, number>; now: number }) {
  if (todo.kind === "event") {
    const { event } = todo;
    const confirmed = counts[event.id] ?? 0;
    const full = event.capacity !== null && confirmed >= event.capacity;
    const seats = event.capacity === null
      ? `${confirmed}명 신청`
      : full
        ? `정원 마감 · 대기 신청 가능 (${confirmed}/${event.capacity}명)`
        : `남은 자리 ${event.capacity - confirmed}석 (${confirmed}/${event.capacity}명)`;
    const [m, d] = monthDay(event.starts_at);
    const badge = dDay(event);
    return (
      <Link href={`/events/${event.id}`} className={`${styles.todo} ${styles.todoEvent}`}>
        <span className={`${styles.todoMark} ${styles.todoMarkDate}`} aria-hidden>
          <span className={styles.todoMarkMonth}>{m}</span>
          <span className={styles.todoMarkDay}>{d}</span>
        </span>
        <span className={styles.todoBody}>
          <span className={styles.todoTags}>
            <span className={styles.tag}>{TYPE_LABELS[event.type]}</span>
            {badge && <span className={`${styles.tag} ${styles.tagPrimary}`}>{badge}</span>}
          </span>
          <span className={styles.todoTitle}>{event.title}</span>
          <span className={styles.muted}>
            {todoWhen(event)}
            {event.location ? ` · ${event.location}` : ""} · {seats}
          </span>
        </span>
        <span className={`${styles.btn} ${styles.btnPrimary}`}>{full ? "대기 신청" : "신청하기"}</span>
      </Link>
    );
  }

  if (todo.kind === "survey") {
    return (
      <Link href={`/surveys/${todo.survey.id}`} className={styles.todo}>
        <span className={styles.todoMark} aria-hidden>
          <SurveyIcon />
        </span>
        <span className={styles.todoBody}>
          <span className={styles.todoTags}>
            <span className={styles.tag}>설문</span>
            <span className={styles.tag}>아직 응답 안 함</span>
          </span>
          <span className={styles.todoTitle}>{todo.survey.title}</span>
        </span>
        <span className={`${styles.btn} ${styles.btnSecondary}`}>응답하기</span>
      </Link>
    );
  }

  return (
    <Link href={`/notices/${todo.notice.id}`} className={styles.todo}>
      <span className={styles.todoMark} aria-hidden>
        <NoticeIcon />
      </span>
      <span className={styles.todoBody}>
        <span className={styles.todoTags}>
          <span className={styles.tag}>공지</span>
          <span className={styles.tag}>새 글 · {daysAgo(todo.notice.published_at, now)}</span>
        </span>
        <span className={styles.todoTitle}>{todo.notice.title}</span>
      </span>
      <span className={`${styles.btn} ${styles.btnSecondary}`}>읽기</span>
    </Link>
  );
}

export function HomeDashboardSkeleton() {
  return (
    <div className={`wds-surface ${styles.home}`}>
      <div className={styles.skeleton} style={{ height: 52, width: 260, borderRadius: 8 }} />
      <div className={styles.grid}>
        <div className={styles.skeleton} style={{ height: 300 }} />
        <div className={styles.col}>
          <div className={styles.skeleton} style={{ height: 200 }} />
          <div className={styles.skeleton} style={{ height: 120 }} />
        </div>
      </div>
      <div className={styles.grid}>
        <div className={styles.skeleton} style={{ height: 200 }} />
        <div className={styles.skeleton} style={{ height: 160 }} />
      </div>
    </div>
  );
}
