import Link from "next/link";
import { AvatarRow } from "@/components/wds/Avatar";
import { ContentBadge, ProgressBar } from "@/components/wds/primitives";
import {
  avatarInitial,
  AVATAR_COLORS,
  dateWithWeekday,
  durationLabel,
} from "@/lib/meeting-poll";
import type { MeetingPoll } from "@/lib/types";
import { pastDue } from "./[id]/poll-detail-time";
import styles from "./schedule.module.css";

export interface PollCard {
  poll: MeetingPoll;
  total: number;
  responded: number;
  /** 아바타로 보여줄 응답자 (최대 6명) */
  people: { name: string; avatarPath: string | null }[];
}

/** 목록 카드. 원본에 목록 화면 시안은 없어 상세 화면의 현황 카드 규격을 따랐다. */
export function PollList({
  cards,
  emptyTitle,
  emptyBody,
}: {
  cards: PollCard[];
  emptyTitle: string;
  emptyBody: string;
}) {
  if (cards.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          padding: "72px 24px",
          background: "var(--wds-bg)",
          borderRadius: 16,
          boxShadow: "var(--wds-shadow-card)",
        }}
      >
        <span style={{ font: "700 16px/1.4 var(--wds-font-sans)", color: "var(--wds-label-normal)" }}>
          {emptyTitle}
        </span>
        <span style={{ font: "400 14px/1.5 var(--wds-font-sans)", color: "var(--wds-label-alternative)" }}>
          {emptyBody}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {cards.map(({ poll, total, responded, people }) => {
        const percent = total ? Math.round((responded / total) * 100) : 0;
        return (
          <Link key={poll.id} href={`/schedule/${poll.id}`} className={styles.listCard}>
            <div className={styles.listContent}>
              <div className={styles.listTitleRow}>
                <span
                  className={styles.listTitle}
                  style={{
                    font: "700 17px/1.4 var(--wds-font-sans)",
                    color: "var(--wds-label-normal)",
                  }}
                >
                  {poll.title}
                </span>
                {poll.is_mojisoop && (
                  <ContentBadge variant="solid" color="violet" size="small">
                    모지숲
                  </ContentBadge>
                )}
                {poll.is_regular_session && (
                  <ContentBadge variant="solid" color="primary" size="small">
                    정기세션
                  </ContentBadge>
                )}
                {/* 상세 화면(PollDetail·GuestRespond)과 같은 세 갈래를 쓴다.
                    마감이 지난 카드까지 "응답 받는 중"으로 보이면 지난 일정 탭에서 아직
                    받는 중인 줄 알고 다시 들어가게 된다. */}
                {poll.confirmed_at ? (
                  <ContentBadge variant="solid" color="primary" size="small">
                    확정됨
                  </ContentBadge>
                ) : pastDue(poll.due_at) ? (
                  <ContentBadge variant="solid" color="neutral" size="small">
                    응답 마감
                  </ContentBadge>
                ) : (
                  <ContentBadge variant="solid" color="orange" size="small">
                    응답 받는 중
                  </ContentBadge>
                )}
              </div>
              <span
                style={{
                  font: "400 13px/1.5 var(--wds-font-sans)",
                  color: "var(--wds-label-alternative)",
                }}
              >
                {poll.confirmed_at
                  ? `${dateWithWeekday(kstDayKey(poll.confirmed_at))} · ${durationLabel(poll.duration_min ?? 0)}`
                  : `${poll.dates[0]} ~ ${poll.dates[poll.dates.length - 1]} · ${poll.start_hour}시~${poll.end_hour}시`}
              </span>
            </div>

            <AvatarRow
              people={people.map((p, i) => ({
                id: `${p.name}-${i}`,
                initial: avatarInitial(p.name),
                color: AVATAR_COLORS[i % AVATAR_COLORS.length],
                avatarPath: p.avatarPath,
              }))}
              size={26}
              overlap={8}
            />

            <div className={styles.listProgress}>
              <span
                style={{
                  font: "500 13px/1.4 var(--wds-font-sans)",
                  color: "var(--wds-label-alternative)",
                }}
              >
                {total}명 중 {responded}명 응답
              </span>
              <ProgressBar value={percent} height={6} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function kstDayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}
