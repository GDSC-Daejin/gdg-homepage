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
import { sumPointsInMonth } from "@/lib/points";
import { formatEventSchedule } from "@/lib/event-schedule";
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

/** "8월 12일 화요일 오후 7:00" — 히어로용 긴 표기 */
function heroWhen(event: Event) {
  if (!event.event_date || !event.starts_at) return formatEventSchedule(event);
  const date = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(event.starts_at));
  return `${date} ${formatKstTime(event.starts_at)}`;
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

function PinIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0M16 11a3 3 0 0 1 0-6M18 20a5 5 0 0 0-2-4" />
    </svg>
  );
}

export async function HomeDashboard({
  month,
  name,
  profileId,
}: {
  month?: string;
  name: string;
  profileId: string;
}) {
  const supabase = await createClient();

  // 서로 의존 없는 쿼리는 한 번에 병렬 실행 (서버 워터폴 제거)
  const [
    { data: noticeRows },
    { data: openSurveys },
    { data: myResponses },
    { data: pointLogs },
    { data: groupMembers },
    { data: events },
  ] = await Promise.all([
    supabase
      .from("notices")
      .select("id, title, published_at")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(3),
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
  const latestSurvey = (openSurveys ?? [])[0];

  const logs = (pointLogs ?? []) as { amount: number; created_at: string }[];
  const monthPoints = sumPointsInMonth(logs, monthKst(new Date().toISOString()));
  const totalPoints = logs.reduce((sum, log) => sum + log.amount, 0);

  const now = Date.now();
  const upcoming = list.filter((e) => eventEnd(e) >= now).reverse();
  const allPast = list.filter((e) => e.event_date && eventEnd(e) < now);

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

  const notices = (noticeRows ?? []) as Pick<Notice, "id" | "title" | "published_at">[];

  const hero = upcoming[0];
  const heroConfirmed = hero ? (counts[hero.id] ?? 0) : 0;
  const heroLeft = hero?.capacity ? Math.max(0, hero.capacity - heroConfirmed) : null;
  const heroBadge = hero ? dDay(hero) : null;

  return (
    <div className={`wds-surface ${styles.home}`}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.greeting}>안녕하세요, {name}님</h1>
          <p className={styles.sub}>
            {upcoming.length > 0
              ? `다가오는 이벤트 ${upcoming.length}개 · 이번 달 ${monthPoints}P 적립`
              : `이번 달 ${monthPoints}P 적립`}
          </p>
        </div>
      </header>

      {hero ? (
        <Link href={`/events/${hero.id}`} className={styles.hero}>
          <div className={styles.heroMain}>
            <div className={styles.heroTags}>
              <span className={styles.tagSolid}>{TYPE_LABELS[hero.type]}</span>
              {heroBadge && <span className={styles.tagOutline}>{heroBadge}</span>}
            </div>
            <div className={styles.heroWhen}>{heroWhen(hero)}</div>
            <h2 className={styles.heroTitle}>{hero.title}</h2>
            <div className={styles.heroMeta}>
              {hero.location && (
                <span className={styles.heroMetaItem}>
                  <PinIcon />
                  {hero.location}
                </span>
              )}
              <span className={styles.heroMetaItem}>
                <PeopleIcon />
                {heroConfirmed}
                {hero.capacity ? ` / ${hero.capacity}` : ""}명 신청
              </span>
            </div>
          </div>
          <div className={styles.heroSide}>
            <div className={styles.heroSideLabel}>{heroLeft === null ? "신청 인원" : "남은 자리"}</div>
            <div className={styles.heroSideValue}>
              {heroLeft === null ? `${heroConfirmed}명` : `${heroLeft}석`}
            </div>
            {hero.capacity ? (
              <div className={styles.heroBar}>
                <div
                  className={styles.heroBarFill}
                  style={{ width: `${Math.min(100, Math.round((heroConfirmed / hero.capacity) * 100))}%` }}
                />
              </div>
            ) : (
              <div style={{ height: 16 }} />
            )}
            <span className={styles.heroCta}>자세히 보기</span>
          </div>
        </Link>
      ) : (
        <p className={styles.heroEmpty}>예정된 이벤트가 없어요.</p>
      )}

      <div className={styles.grid}>
        <div className={styles.col}>
          <section className={styles.card}>
            <div className={`${styles.cardHead} ${styles.cardHeadFilled}`}>
              <h2 className={styles.cardTitle}>내 스터디·프로젝트</h2>
              {myGroups.length > 0 && <span className={styles.cardMeta}>{myGroups.length}개</span>}
            </div>
            {myGroups.length === 0 ? (
              <div className={styles.emptyCta}>
                <div>
                  <p className={styles.emptyCtaTitle}>아직 참여 중인 스터디·프로젝트가 없어요</p>
                  <p className={styles.emptyCtaSub}>모집 중인 활동은 곧 목록에서 확인할 수 있어요.</p>
                </div>
                <button type="button" disabled className={styles.emptyCtaButton}>
                  모집 중인 스터디·프로젝트 보기
                </button>
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

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>지난 이벤트</h2>
              <MonthFilter options={monthOptions} value={month ?? ""} basePath="/" />
            </div>
            {past.length === 0 ? (
              <p className={styles.empty}>지난 이벤트가 없어요.</p>
            ) : (
              <div className={styles.cardBody} style={{ gap: 9 }}>
                {past.map((event) => (
                  <Link key={event.id} href={`/events/${event.id}`} className={styles.pastRow}>
                    <span className={styles.pastDot} />
                    <span className={styles.pastDate}>{shortDate(event.starts_at)}</span>
                    <span className={styles.pastTitle}>
                      {event.title}
                      {event.location ? ` · ${event.location}` : ""}
                    </span>
                    <span className={styles.pastCount}>
                      {counts[event.id] ?? 0}
                      {event.capacity ? `/${event.capacity}` : ""}명
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>
                <span className={`${styles.accent} ${styles.accentMuted}`} />
                설문
              </h2>
            </div>
            {latestSurvey ? (
              <Link href={`/surveys/${latestSurvey.id}`} className={styles.listItem}>
                <div className={styles.listTitle}>{latestSurvey.title}</div>
                <div className={styles.listSub}>
                  {respondedIds.has(latestSurvey.id) ? "응답 완료" : "응답하기"}
                </div>
              </Link>
            ) : (
              <p className={styles.empty}>열린 설문이 없어요.</p>
            )}
          </section>
        </div>

        <div className={styles.col}>
          <Link href="/profile" className={styles.activity}>
            <div className={styles.activityHead}>
              내 활동
              <span className={styles.activityLink}>내역 보기</span>
            </div>
            <div className={styles.activityValue}>
              <span className={styles.activityNum}>{totalPoints}</span>
              <span className={styles.activityUnit}>P</span>
              {monthPoints > 0 && <span className={styles.activityDelta}>이번 달 +{monthPoints}P</span>}
            </div>
            <div className={styles.activityFoot}>
              <div>
                <div className={styles.activityFootLabel}>참여 중인 활동</div>
                <div className={styles.activityFootValue}>{myGroups.length}개</div>
              </div>
              <div>
                <div className={styles.activityFootLabel}>다가오는 이벤트</div>
                <div className={styles.activityFootValue}>{upcoming.length}개</div>
              </div>
            </div>
          </Link>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>
                <span className={styles.accent} />
                공지
              </h2>
              <Link href="/notices" className={styles.cardMeta}>
                전체 보기
              </Link>
            </div>
            {notices.length === 0 ? (
              <p className={styles.empty}>등록된 공지가 없어요.</p>
            ) : (
              <div className={styles.cardBody}>
                {notices.map((notice, i) => (
                  <Link key={notice.id} href={`/notices/${notice.id}`} className={styles.listItem}>
                    <div className={`${styles.listTitle} ${i === 0 ? styles.listTitleLead : ""}`}>
                      {notice.title}
                    </div>
                    {notice.published_at && (
                      <div className={styles.listSub}>{formatRelativeKst(notice.published_at)}</div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export function HomeDashboardSkeleton() {
  return (
    <div className={`wds-surface ${styles.home}`}>
      <div className={styles.skeleton} style={{ height: 44, width: 260, borderRadius: 8 }} />
      <div className={styles.skeleton} style={{ height: 208, borderRadius: 20 }} />
      <div className={styles.grid}>
        <div className={styles.col}>
          <div className={styles.skeleton} style={{ height: 140 }} />
          <div className={styles.skeleton} style={{ height: 180 }} />
        </div>
        <div className={styles.col}>
          <div className={styles.skeleton} style={{ height: 150 }} />
          <div className={styles.skeleton} style={{ height: 150 }} />
        </div>
      </div>
    </div>
  );
}
