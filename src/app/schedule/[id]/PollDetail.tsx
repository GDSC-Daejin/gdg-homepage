"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  applyBackupMeetingPoll,
  closeMeetingPoll,
  confirmMeetingPoll,
  nudgeMeetingPoll,
  saveMyAttendance,
  saveMyAvailability,
  unconfirmMeetingPoll,
} from "@/actions/meeting-poll";
import { Avatar, AvatarRow } from "@/components/wds/Avatar";
import { Button } from "@/components/wds/Button";
import {
  Callout,
  ContentBadge,
  ProgressBar,
} from "@/components/wds/primitives";
import { cellFromPoint, ScheduleGrid } from "@/components/wds/ScheduleGrid";
import { useToast } from "@/components/wds/Toast";
import {
  aggregate,
  backupRecommendations,
  dateWithWeekday,
  durationLabel,
  HEAT_STEPS,
  heatStep,
  MIN_BLOCK_MIN,
  pollTimes,
  REGULAR_SESSION_MIN_BLOCK_MIN,
  recommendBlocks,
  shortDate,
  slotIso,
  timeAmPm,
  toViews,
  weekdayKo,
  type Cell,
  type Participant,
} from "@/lib/meeting-poll";
import type { MeetingPoll } from "@/lib/types";
import { availabilityViews, draftAvailability, type AvailabilityDrag } from "@/lib/meeting-poll-availability";
import { MetaChip, PeopleTooltip, PersonRow } from "./PollDetailPeople";
import {
  addMinutes,
  adjustmentOptions,
  endOf,
  kstDayKey,
  kstTime,
  nearestDuration,
  pastDue,
} from "./poll-detail-time";
import styles from "../schedule.module.css";

const NudgeDialog = dynamic(() =>
  import("./PollDetailDialogs").then((module) => module.NudgeDialog),
);
const ConfirmDialog = dynamic(() =>
  import("./PollDetailDialogs").then((module) => module.ConfirmDialog),
);

/** 선택한 칸 상세 카드의 헤더/한 줄 높이. 자리를 미리 잡아 선택할 때 화면이 뛰지 않게 한다. */
const DETAIL_HEADER_H = 69;
const DETAIL_ROW_H = 69;

interface PollDetailProps {
  poll: MeetingPoll;
  participants: Participant[];
  /** 로그인한 사람의 참여자 id. 참여자가 아니면 null */
  myParticipantId: string | null;
  canManage: boolean;
  canNudge: boolean;
  ownerName: string;
}

export function PollDetail({
  poll,
  participants,
  myParticipantId,
  canManage,
  canNudge,
  ownerName,
}: PollDetailProps) {
  const router = useRouter();
  const dates = poll.dates;
  const times = useMemo(
    () => pollTimes(poll.start_hour, poll.end_hour, poll.slot_min),
    [poll.start_hour, poll.end_hour, poll.slot_min],
  );

  const views = useMemo(() => toViews(participants), [participants]);
  const me = views.find((v) => v.id === myParticipantId) ?? null;
  const locked = Boolean(poll.confirmed_at) || pastDue(poll.due_at);

  const [mine, setMine] = useState<Set<string>>(() => new Set(me?.slots ?? []));
  const [drag, setDrag] = useState<AvailabilityDrag | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  /** 말풍선은 마우스를 뗀 순간 사라져야 한다 — 클릭으로 남는 selected와 따로 둔다. */
  const [hovered, setHovered] = useState<Cell | null>(null);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [showCounts, setShowCounts] = useState(false);
  const [participantFilter, setParticipantFilter] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState(false);
  const [confirming, setConfirming] = useState<{
    startIso: string;
    durationMin: number;
    timeOptions?: { value: string; label: string }[];
    backup?: boolean;
  } | null>(null);
  const [nudging, setNudging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const { show, toast } = useToast();

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  /** 드래그 중에는 커밋 전 미리보기를 그린다. 히트맵도 같은 값으로 즉시 반응한다. */
  const draft = useMemo(() => draftAvailability(mine, drag, dates, times), [drag, mine, dates, times]);

  /**
   * 내 응답은 화면 상태가 진실이다. 나머지는 서버에서 받은 그대로.
   * 단 격자 위 카드(응답 현황·추천)는 커밋된 값으로만 그린다 — 드래그 중에 다시 계산하면
   * 카드 높이가 바뀌면서 격자가 손 아래에서 밀리고, 그러면 칠하던 칸이 어긋난다.
   */
  const liveViews = useMemo(() => availabilityViews(views, myParticipantId, mine, false), [views, myParticipantId, mine]);
  /** 히트맵만 드래그 미리보기를 따른다 — 칸 색은 즉시 바뀌어도 레이아웃은 그대로다. */
  const heatViews = useMemo(() => availabilityViews(views, myParticipantId, draft, false), [views, myParticipantId, draft]);

  const responded = liveViews.filter((v) => v.responded);
  const pending = liveViews.filter((v) => !v.responded);
  const filteredViews = participantFilter
    ? liveViews.filter((view) => view.id === participantFilter)
    : liveViews;
  const filteredResponded = filteredViews.filter((view) => view.responded);
  const filteredPending = filteredViews.filter((view) => !view.responded);
  const available = useMemo(() => aggregate(heatViews), [heatViews]);
  const filteredAvailable = useMemo(() => aggregate(filteredViews), [filteredViews]);
  /** 히트맵 농도의 분모. 드래그로 내가 응답자가 되면 여기도 같이 늘어야 색이 튀지 않는다. */
  const heatTotal = useMemo(() => heatViews.filter((v) => v.responded).length, [heatViews]);
  const gridTotal = participantFilter ? filteredResponded.length : heatTotal;
  const percent = liveViews.length
    ? Math.round((responded.length / liveViews.length) * 100)
    : 0;

  // 80%(초대 7명이면 6명)는 너무 늦게 켜진다 — 3명만 모이면 겹치는 구간이 보인다.
  const recommendGate = Math.min(3, liveViews.length);
  const recommendationMin = poll.is_regular_session
    ? REGULAR_SESSION_MIN_BLOCK_MIN
    : MIN_BLOCK_MIN;
  const recommendations = useMemo(
    () =>
      responded.length >= recommendGate
        ? recommendBlocks(dates, times, liveViews, poll.slot_min, 3, recommendationMin)
        : [],
    [responded.length, recommendGate, dates, times, liveViews, poll.slot_min, recommendationMin],
  );
  const visibleRecommendations = poll.confirmed_at
    ? backupRecommendations(recommendations, poll.confirmed_at)
    : recommendations;

  const blockAt = (cell: Cell) =>
    participantFilter
      ? undefined
      : recommendations.find(
          (r) =>
            r.dateIndex === cell.dateIndex &&
            cell.timeIndex >= r.from &&
            cell.timeIndex <= r.to,
        );

  // 다른 사람이 이만큼 모인 칸이면 여기에 칠하는 게 확정을 빠르게 한다.
  const othersTotal = Math.max(0, responded.length - (me?.responded || mine.size > 0 ? 1 : 0));
  const hintThreshold = Math.max(2, othersTotal - 1);

  function startDrag(e: React.PointerEvent, cell: Cell) {
    if (locked || !myParticipantId) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const slot = slotIso(dates[cell.dateIndex], times[cell.timeIndex]);
    setDrag({ mode: mine.has(slot) ? "erase" : "paint", anchor: cell, cursor: cell });
  }

  function moveDrag(e: React.PointerEvent) {
    if (!drag) return;
    const cell = cellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    if (cell.dateIndex !== drag.cursor.dateIndex || cell.timeIndex !== drag.cursor.timeIndex) {
      setDrag({ ...drag, cursor: cell });
    }
  }

  function endDrag() {
    if (!drag) return;
    const next = draft;
    setDrag(null);
    setMine(next);
    save(next, mine);
  }

  /**
   * 칠한 결과는 이미 화면에 있다. 저장은 뒤에서 하고 화면을 다시 그리지 않는다 —
   * router.refresh()는 남의 응답까지 다시 받아오느라 격자를 멈춰 세운다.
   */
  function save(next: Set<string>, before: Set<string>) {
    setError(undefined);
    setSaving(true);
    saveMyAvailability(poll.id, [...next])
      .then((result) => {
        // 실패한 채로 두면 화면과 서버가 조용히 어긋난다. 되돌리고 알린다.
        if (result.error) {
          setMine(before);
          setError(result.error);
        }
      })
      .finally(() => setSaving(false));
  }

  function run(fn: () => Promise<{ error?: string; warning?: string }>, after?: () => void) {
    setError(undefined);
    setBusy(true);
    fn()
      .then((result) => {
        if (result.error) setError(result.error);
        else {
          after?.();
          router.refresh();
        }
        // 주 작업은 끝났는데 곁가지(노션 등)가 어긋난 경우 — 토스트로만 알린다.
        if (result.warning) show(result.warning);
      })
      .finally(() => setBusy(false));
  }

  if (poll.response_mode === "attendance") {
    const counts = participants.reduce((all, participant) => {
      const response = participant.attendance_response;
      if (response) all[response] += 1;
      return all;
    }, { attending: 0, absent: 0, undecided: 0 });
    const mineResponse = participants.find((participant) => participant.id === myParticipantId)?.attendance_response;
    return <div className={styles.detailPage}>
      <div className={styles.detailHeader}><div><h1 className={styles.detailTitleRow}>{poll.title}</h1><p>세미나 참석 의사를 수집하는 일정이에요.</p></div>
        {canManage && !locked && <Button variant="outlined" color="negative" size="medium" disabled={busy} onClick={() => run(() => closeMeetingPoll(poll.id))}>응답 종료</Button>}
      </div>
      {error && <Callout tone="negative">{error}</Callout>}
      <div className={styles.responseSummary}><strong>{participants.length}명 중 {participants.filter((participant) => participant.responded_at).length}명이 응답했어요</strong>
        <span>참석 {counts.attending}명 · 불참 {counts.absent}명 · 미정 {counts.undecided}명</span>
        {canNudge && pending.length > 0 && !locked && <Button variant="outlined" color="primary" size="medium" disabled={busy} onClick={() => run(() => nudgeMeetingPoll(poll.id))}>{pending.length}명에게 알림</Button>}
      </div>
      {me && !locked && <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 24, background: "var(--wds-bg)", borderRadius: 16 }}>
        <strong>{mineResponse ? "응답을 바꿀 수 있어요" : "참석 의사를 알려주세요"}</strong>
        <div style={{ display: "flex", gap: 8 }}>{(["attending", "absent", "undecided"] as const).map((response) => <Button key={response} variant={mineResponse === response ? "solid" : "outlined"} color="primary" size="medium" disabled={saving} onClick={() => run(() => saveMyAttendance(poll.id, response))}>{({ attending: "참석", absent: "불참", undecided: "미정" })[response]}</Button>)}</div>
      </div>}
    </div>;
  }

  const selectedNames = selected ? (filteredAvailable.get(selected) ?? []) : [];
  const selectedMissing = selected
    ? filteredResponded.filter((v) => !selectedNames.includes(v))
    : [];
  const selectedBlock = selected && !participantFilter
    ? recommendations.find((r) => r.startIso <= selected && selected <= endOf(r, times, dates))
    : undefined;

  return (
    <div className={styles.detailPage}>
      {/* ── 제목 줄 ── */}
      <div className={styles.detailHeader}>
        <div style={{ display: "contents" }}>
          <div className={styles.detailTitleRow}>
            <h1
              style={{
                margin: 0,
                font: "700 28px/1.35 var(--wds-font-sans)",
                letterSpacing: "-0.025em",
                color: "var(--wds-label-normal)",
              }}
            >
              {poll.title}
            </h1>
            {poll.is_mojisoop && (
              <ContentBadge variant="solid" color="violet" size="medium">
                모지숲
              </ContentBadge>
            )}
            {poll.confirmed_at ? (
              <ContentBadge variant="solid" color="primary" size="medium">
                확정됨
              </ContentBadge>
            ) : pastDue(poll.due_at) ? (
              <ContentBadge variant="solid" color="neutral" size="medium">
                응답 마감
              </ContentBadge>
            ) : (
              <ContentBadge variant="solid" color="orange" size="medium">
                응답 받는 중
              </ContentBadge>
            )}
          </div>
          <div className={styles.metaGrid}>
            <MetaChip label="날짜" icon={<TinyIcon d="M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1" />}>
              {shortDate(dates[0])}({weekdayKo(dates[0])}) ~ {shortDate(dates[dates.length - 1])}(
              {weekdayKo(dates[dates.length - 1])}) · {dates.length}일
            </MetaChip>
            <MetaChip label="시간" icon={<TinyIcon d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />}>
              {poll.start_hour}시 ~ {poll.end_hour}시
            </MetaChip>
            {poll.due_at && (
              <MetaChip label="응답 마감" icon={<TinyIcon d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />} emphasis>
                {dateWithWeekday(kstDayKey(poll.due_at))} {kstTime(poll.due_at)}
              </MetaChip>
            )}
            <MetaChip label="만든 사람" icon={<TinyIcon d="M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />} className={styles.metaOwner}>{ownerName}</MetaChip>
          </div>
        </div>
        <div className={styles.detailActions}>
          {canManage && <Button
            variant="outlined"
            color="assistive"
            size="medium"
            leadingIcon={<TinyIcon d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />}
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              show("일정 링크를 복사했어요");
            }}
          >
            일정 링크 복사
          </Button>}
          <Button
            variant="outlined"
            color="assistive"
            size="medium"
            onClick={() => router.back()}
          >
            돌아가기
          </Button>
          {canManage && (
            <>
              {!poll.confirmed_at && (
                <Button
                  variant="outlined"
                  color="assistive"
                  size="medium"
                  disabled={busy}
                  onClick={() => router.push(`/schedule/${poll.id}/edit`)}
                >
                  수정
                </Button>
              )}
              {!locked && (
                <Button
                  variant="outlined"
                  color="negative"
                  size="medium"
                  disabled={busy}
                  onClick={() => {
                    if (!confirm("응답을 종료할까요? 더 이상 응답을 바꿀 수 없어요.")) return;
                    run(() => closeMeetingPoll(poll.id));
                  }}
                >
                  응답 종료
                </Button>
              )}
              <Button
                variant="outlined"
                color="negative"
                size="medium"
                disabled={busy}
                leadingIcon={<TinyIcon d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" />}
                onClick={() => {
                  if (!confirm("일정을 삭제할까요? 모인 응답도 함께 사라져요.")) return;
                  run(
                    () => import("@/actions/meeting-poll").then((m) => m.deleteMeetingPoll(poll.id)),
                    () => router.push("/schedule"),
                  );
                }}
              >
                삭제
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 에러는 스스로 사라지면 안 되니 그대로 남긴다. 알림성 메시지만 토스트로 뜬다. */}
      {error && <Callout tone="negative">{error}</Callout>}
      {toast}

      {/* ── 응답 현황 ── */}
      <div className={styles.responseSummary}>
        <div className={styles.responseStatus}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ font: "700 16px/1.4 var(--wds-font-sans)", color: "var(--wds-label-normal)" }}>
              {liveViews.length}명 중 {responded.length}명이 응답했어요
            </span>
            <span style={{ font: "500 13px/1.4 var(--wds-font-sans)", color: "var(--wds-label-alternative)" }}>
              {percent}%
            </span>
          </div>
          <ProgressBar value={percent} height={6} />
        </div>
        <div className={styles.responseDivider} />
        <div className={styles.responsePeople}>
          <span
            style={{
              font: "500 13px/1.4 var(--wds-font-sans)",
              color: "var(--wds-label-alternative)",
              flexShrink: 0,
            }}
          >
            응답 완료
          </span>
          <AvatarRow people={responded} size={30} overlap={8} />
          {pending.length > 0 && (
            <>
              <span
                style={{
                  font: "500 13px/1.4 var(--wds-font-sans)",
                  color: "var(--wds-label-alternative)",
                  flexShrink: 0,
                  marginLeft: 8,
                }}
              >
                아직 안 함
              </span>
              {/* "외 N명"에 가려진 사람은 여기 올려야 보인다 — 격자와 같은 말풍선을 쓴다. */}
              <div
                style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}
                onPointerEnter={() => setPendingOpen(true)}
                onPointerLeave={() => setPendingOpen(false)}
              >
                <Avatar
                  initial={pending[0].initial}
                  size={30}
                  pending
                  avatarPath={pending[0].avatarPath}
                />
                <span
                  style={{
                    font: "500 14px/1.4 var(--wds-font-sans)",
                    color: "var(--wds-label-neutral)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {pending.length === 1
                    ? pending[0].name
                    : `${pending[0].name} 외 ${pending.length - 1}명`}
                </span>
                {pendingOpen && pending.length > 1 && (
                  <PeopleTooltip people={pending} align="start" below max={30} />
                )}
              </div>
            </>
          )}
        </div>
        {canNudge && pending.length > 0 && !locked && (
          <Button
            variant="outlined"
            color="primary"
            size="medium"
            round
            disabled={busy}
            onClick={() => setNudging(true)}
          >
            {pending.length}명에게 슬랙 알림 보내기
          </Button>
        )}
      </div>

      {/* ── 확정 배너 ── */}
      {poll.confirmed_at && (
        <div className={styles.confirmedBanner}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ font: "700 13px/1.4 var(--wds-font-sans)", color: "var(--wds-primary-strong)" }}>
              확정된 일정
            </span>
            <span style={{ font: "700 20px/1.35 var(--wds-font-sans)", color: "var(--wds-label-normal)" }}>
              {dateWithWeekday(kstDayKey(poll.confirmed_at))} {timeAmPm(kstTime(poll.confirmed_at))}
              {" · "}
              {durationLabel(poll.duration_min ?? 0)}
            </span>
          </div>
          {canManage && (
            <Button
              variant="text"
              color="assistive"
              size="medium"
              disabled={busy}
              onClick={() => run(() => unconfirmMeetingPoll(poll.id))}
            >
              확정 취소
            </Button>
          )}
        </div>
      )}

      {/* ── 추천 시간 / 백업 플랜 ── */}
      {(!poll.confirmed_at || visibleRecommendations.length > 0) && <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "22px 24px 24px",
          background: "var(--wds-bg)",
          borderRadius: 16,
          boxShadow: "var(--wds-shadow-card)",
        }}
      >
        <div className={styles.recommendationHeader}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <h2
              style={{
                margin: 0,
                font: "700 20px/1.4 var(--wds-font-sans)",
                letterSpacing: "-0.015em",
                color: "var(--wds-label-normal)",
              }}
            >
              {poll.confirmed_at ? "백업 플랜" : "이 시간이 제일 좋아요"}
            </h2>
            <p
              style={{
                margin: 0,
                font: "400 14px/1.5 var(--wds-font-sans)",
                color: "var(--wds-label-alternative)",
              }}
            >
              {visibleRecommendations.length > 0
                ? poll.confirmed_at
                  ? "확정 시간을 바꿔야 할 때 검토할 수 있는 다음 후보예요."
                  : `응답한 ${responded.length}명 기준으로 가장 많이 겹치는 시간을 골랐어요. 격자에 표시된 번호와 같은 시간이에요.`
                : `${recommendGate}명 이상 응답하면 가장 많이 겹치는 시간을 골라드려요. 지금 ${responded.length}명이에요.`}
            </p>
          </div>
          <span
            style={{
              font: "500 13px/1.4 var(--wds-font-sans)",
              color: "var(--wds-label-alternative)",
              whiteSpace: "nowrap",
            }}
          >
            최소 {durationLabel(Math.max(recommendationMin, poll.slot_min))} 연속 가능한 구간만
          </span>
        </div>

        {visibleRecommendations.length > 0 && (
          <div className={`${styles.recommendationCards} ${poll.confirmed_at ? styles.backupCards : ""}`}>
            {visibleRecommendations.map((r, index) => {
              const first = !poll.confirmed_at && r.rank === 1;
              const endTime = addMinutes(times[r.from], r.durationMin);
              return (
                <div
                  key={r.rank}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    padding: "18px 18px 16px",
                    borderRadius: 14,
                    background: first ? "var(--wds-primary-bg)" : "var(--wds-bg)",
                    boxShadow: first
                      ? "inset 0 0 0 1.5px rgba(0,102,255,0.32)"
                      : "inset 0 0 0 1px var(--wds-line-neutral)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          background: first ? "var(--wds-primary)" : "var(--wds-fill-strong)",
                          color: first ? "#fff" : "var(--wds-label-neutral)",
                          font: "700 12px/1 var(--wds-font-sans)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {poll.confirmed_at ? index + 1 : r.rank}
                      </span>
                      <span
                        style={{
                          font: "600 13px/1.4 var(--wds-font-sans)",
                          color: first ? "var(--wds-primary-strong)" : "var(--wds-label-alternative)",
                        }}
                      >
                        {poll.confirmed_at
                          ? `${index === 0 ? "첫 번째" : "두 번째"} 백업`
                          : r.rank === 1 ? "가장 좋아요" : r.rank === 2 ? "두 번째로 좋아요" : "세 번째로 좋아요"}
                      </span>
                    </div>
                    <span
                      style={{
                        font: "500 12px/1.4 var(--wds-font-sans)",
                        color: "var(--wds-label-alternative)",
                      }}
                    >
                      {durationLabel(r.durationMin)} 연속
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span
                      style={{
                        font: "600 15px/1.4 var(--wds-font-sans)",
                        color: "var(--wds-label-neutral)",
                      }}
                    >
                      {dateWithWeekday(dates[r.dateIndex])}
                    </span>
                    <span
                      style={{
                        font: "700 26px/1.3 var(--wds-font-sans)",
                        letterSpacing: "-0.02em",
                        color: "var(--wds-label-normal)",
                      }}
                    >
                      {timeAmPm(times[r.from])} ~ {timeAmPm(endTime)}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <AvatarRow people={r.available} size={26} overlap={7} />
                      <span
                        style={{
                          font: "600 14px/1.4 var(--wds-font-sans)",
                          color:
                            r.missing.length === 0
                              ? "var(--wds-primary-strong)"
                              : "var(--wds-label-neutral)",
                        }}
                      >
                        {r.missing.length === 0
                          ? `${r.available.length}명 모두 가능`
                          : `${r.available.length}명 가능`}
                      </span>
                    </div>
                    <div
                      style={{
                        minHeight: 20,
                        font: "400 13px/1.5 var(--wds-font-sans)",
                        color: "var(--wds-label-alternative)",
                      }}
                    >
                      {r.missing.length === 0
                        ? "응답한 분 전원이 비어 있어요"
                        : `안 되는 분 · ${r.missing.map((p) => p.name).join(", ")}`}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                    {!poll.confirmed_at && <Button
                      variant={first ? "solid" : "outlined"}
                      color="primary"
                      size="medium"
                      fullWidth
                      disabled={!canManage || busy}
                      onClick={() =>
                        setConfirming({
                          startIso: r.startIso,
                          durationMin: nearestDuration(r.durationMin),
                        })
                      }
                    >
                      일정 확정하기
                    </Button>}
                    {poll.confirmed_at && <Button
                      variant="solid"
                      color="primary"
                      size="medium"
                      fullWidth
                      disabled={!canManage || busy}
                      onClick={() =>
                        setConfirming({
                          startIso: r.startIso,
                          durationMin: nearestDuration(r.durationMin),
                          backup: true,
                        })
                      }
                    >
                      백업플랜 적용하기
                    </Button>}
                    <Button
                      variant="text"
                      color="assistive"
                      size="medium"
                      disabled={!canManage || busy}
                      onClick={() => {
                        const options = adjustmentOptions(r, times, dates);
                        setConfirming({
                          startIso: options[0]?.startIso ?? r.startIso,
                          durationMin: 30,
                          timeOptions: options.map(({ startIso, label }) => ({ value: startIso, label })),
                          backup: Boolean(poll.confirmed_at),
                        });
                      }}
                    >
                      시간 조정
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>}

      {/* ── 격자 2단 ── */}
      <div className={styles.scheduleGrids}>
        {/* 내가 가능한 시간 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <div className={styles.gridHeader} style={{ alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <h3 style={{ margin: 0, font: "700 18px/1.4 var(--wds-font-sans)", color: "var(--wds-label-normal)" }}>
                내가 가능한 시간
              </h3>
              <p
                style={{
                  margin: 0,
                  font: "400 13px/1.5 var(--wds-font-sans)",
                  color: "var(--wds-label-alternative)",
                }}
              >
                {!myParticipantId
                  ? "이 일정의 참여자가 아니라 칠할 수 없어요"
                  : locked
                    ? poll.confirmed_at
                      ? "확정된 일정이라 수정할 수 없어요"
                      : "응답 마감이 지나 수정할 수 없어요"
                    : isMobile && !editingAvailability
                      ? "수정을 누르면 가능한 시간을 선택할 수 있어요"
                      : "칸을 끌어서 칠하세요. 칠한 칸에서 시작하면 지워져요"}
              </p>
            </div>
            <Button
              variant="outlined"
              color="primary"
              size="small"
              disabled={!myParticipantId || locked || saving}
              onClick={() => {
                if (isMobile) setEditingAvailability((editing) => !editing);
                else save(mine, mine);
              }}
            >
              {isMobile ? (editingAvailability ? "완료" : "수정") : saving ? "저장 중…" : "저장하기"}
            </Button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: "var(--wds-primary)" }} />
            <span style={{ font: "400 12px/1.4 var(--wds-font-sans)", color: "var(--wds-label-alternative)" }}>
              내가 가능
            </span>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: "rgba(0,102,255,0.10)",
                marginLeft: 8,
              }}
            />
            <span style={{ font: "400 12px/1.4 var(--wds-font-sans)", color: "var(--wds-label-alternative)" }}>
              다른 분들 {hintThreshold}명 이상 가능 — 여기에 칠하면 확정이 빨라져요
            </span>
          </div>

          <div className={styles.gridScroller}>
            <ScheduleGrid
              dates={dates}
              times={times}
              slotMin={poll.slot_min}
              interactive={Boolean(myParticipantId) && !locked && (!isMobile || editingAvailability)}
              onCellPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={{ minWidth: 52 + dates.length * 56 }}
              cell={({ dateIndex, timeIndex }) => {
                const slot = slotIso(dates[dateIndex], times[timeIndex]);
                const isMine = draft.has(slot);
                const others = (available.get(slot) ?? []).filter((p) => p.id !== myParticipantId).length;
                return {
                  background: isMine
                    ? "var(--wds-primary)"
                    : others >= hintThreshold
                      ? "rgba(0,102,255,0.10)"
                      : "var(--wds-bg)",
                };
              }}
            />
          </div>
        </div>

        {/* 전체 가능한 시간 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <div className={styles.gridHeader} style={{ alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <h3 style={{ margin: 0, font: "700 18px/1.4 var(--wds-font-sans)", color: "var(--wds-label-normal)" }}>
                {participantFilter
                  ? `${filteredViews[0]?.name ?? "선택한 멤버"}님의 가능한 시간`
                  : "전체 가능한 시간"}
              </h3>
              <p
                style={{
                  margin: 0,
                  font: "400 13px/1.5 var(--wds-font-sans)",
                  color: "var(--wds-label-alternative)",
                }}
              >
                {participantFilter
                  ? "파란 칸이 이 멤버가 응답한 가능 시간이에요"
                  : <>진할수록 많이 겹쳐요{recommendations.length > 0 && ". 테두리 친 “N순위”는 위 추천 카드와 같은 시간이에요"}</>}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ font: "500 13px/1.4 var(--wds-font-sans)", color: "var(--wds-label-alternative)" }}>
                응답자 선택
                <select
                  className={styles.participantFilter}
                  value={participantFilter}
                  onChange={(event) => setParticipantFilter(event.target.value)}
                >
                  <option value="">전체 응답</option>
                  {responded.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
              </label>
              {!participantFilter && <Button
                variant="text"
                color="assistive"
                size="small"
                onClick={() => setShowCounts((v) => !v)}
              >
                인원수 표시
              </Button>}
            </div>
          </div>

          <div className={styles.gridLegend}>
            <span
              style={{
                font: "400 12px/1.4 var(--wds-font-sans)",
                color: "var(--wds-label-alternative)",
                marginRight: 2,
              }}
            >
              0명
            </span>
            {HEAT_STEPS.map((bg, i) => (
              <span
                key={i}
                style={{
                  width: 18,
                  height: 14,
                  borderRadius: 3,
                  background: bg,
                  boxShadow: "inset 0 0 0 1px var(--wds-line-alternative)",
                }}
              />
            ))}
            <span
              style={{
                font: "400 12px/1.4 var(--wds-font-sans)",
                color: "var(--wds-label-alternative)",
                marginLeft: 2,
              }}
            >
              {filteredResponded.length}명
            </span>
            {!participantFilter && pending.length > 0 && (
              <span
                style={{
                  font: "400 12px/1.4 var(--wds-font-sans)",
                  color: "var(--wds-label-alternative)",
                  marginLeft: 10,
                }}
              >
                {pending.length === 1
                  ? `${pending[0].name}님이 응답하면 최대 ${liveViews.length}명까지 늘어나요`
                  : `${pending.length}명이 더 응답하면 최대 ${liveViews.length}명까지 늘어나요`}
              </span>
            )}
          </div>

          <div className={styles.gridScroller}>
            <ScheduleGrid
              dates={dates}
              times={times}
              slotMin={poll.slot_min}
              interactive
              onCellPointerEnter={(cell) => {
                setSelected(slotIso(dates[cell.dateIndex], times[cell.timeIndex]));
                setHovered(cell);
              }}
              onCellClick={(cell) =>
                setSelected(slotIso(dates[cell.dateIndex], times[cell.timeIndex]))
              }
              onPointerLeave={() => setHovered(null)}
              style={{ minWidth: 52 + dates.length * 56 }}
              cell={(cell) => {
                const slot = slotIso(dates[cell.dateIndex], times[cell.timeIndex]);
                const people = filteredAvailable.get(slot) ?? [];
                const count = people.length;
                const isHovered =
                  hovered?.dateIndex === cell.dateIndex && hovered?.timeIndex === cell.timeIndex;
                const block = blockAt(cell);
                const isSel = selected === slot;
                let boxShadow: string | undefined;
                let zIndex = 1;
                if (block) {
                  // 칸마다 사방을 두르면 한 구간이 여러 조각으로 보인다 —
                  // 위아래는 구간의 처음·끝에만 그어 한 덩어리로 읽히게 한다.
                  const line =
                    block.rank === 1 ? "rgba(0,84,209,0.95)" : "rgba(0,102,255,0.40)";
                  const edges = [`inset 1.5px 0 0 ${line}`, `inset -1.5px 0 0 ${line}`];
                  if (cell.timeIndex === block.from) edges.push(`inset 0 1.5px 0 ${line}`);
                  if (cell.timeIndex === block.to) edges.push(`inset 0 -1.5px 0 ${line}`);
                  boxShadow = edges.join(", ");
                  zIndex = 2;
                }
                if (isSel) {
                  // 진한 칸 위의 검정 테두리는 파랑을 갉아먹는다 — 숫자 색과 같은 기준으로 흰 테두리를 쓴다.
                  boxShadow =
                    heatStep(count, gridTotal) >= 4
                      ? "inset 0 0 0 2px rgba(255,255,255,0.92)"
                      : "inset 0 0 0 2px var(--wds-label-normal)";
                  zIndex = 3;
                }
                // 말풍선이 옆 칸에 가리지 않게 올린다.
                if (isHovered && count > 0) zIndex = 20;
                return {
                  background: HEAT_STEPS[heatStep(count, gridTotal)],
                  boxShadow,
                  zIndex,
                  content: (
                    <>
                      {isHovered && count > 0 && (
                        <PeopleTooltip
                          people={people}
                          // 격자 가장자리에서 말풍선이 카드 밖으로 나가지 않게 붙는 쪽을 바꾼다.
                          align={
                            cell.dateIndex === 0
                              ? "start"
                              : cell.dateIndex === dates.length - 1
                                ? "end"
                                : "center"
                          }
                          below={cell.timeIndex < 3}
                        />
                      )}
                      {block && cell.timeIndex === block.from && (
                        // 숫자만 있으면 격자만 보는 사람은 뜻을 모른다 — 구간 안에 "N순위"로 적는다.
                        <span
                          style={{
                            position: "absolute",
                            top: 3,
                            left: 3,
                            height: 18,
                            padding: "0 7px",
                            borderRadius: 999,
                            background: "var(--wds-primary-heavy)",
                            color: "#fff",
                            font: "700 10px/1 var(--wds-font-sans)",
                            whiteSpace: "nowrap",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 0 0 1.5px var(--wds-bg)",
                            zIndex: 6,
                          }}
                        >
                          {block.rank}순위
                        </span>
                      )}
                      {!participantFilter && showCounts && count > 0 && (
                        <span
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            font: "600 10px/1 var(--wds-font-sans)",
                            color:
                              heatStep(count, gridTotal) >= 4
                                ? "#fff"
                                : "var(--wds-label-alternative)",
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </>
                  ),
                };
              }}
            />
          </div>

          {/* 선택한 칸 상세 */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              background: "var(--wds-bg-elevated)",
              borderRadius: 16,
              boxShadow: "var(--wds-shadow-card)",
              marginTop: 2,
              // 칸을 처음 고르는 순간 안내문 한 줄이 명단으로 부풀면 페이지가 통째로 뛴다.
              // 채워진 뒤 높이(헤더 + 줄마다 69px)를 미리 잡아둔다.
              minHeight: DETAIL_HEADER_H + DETAIL_ROW_H * (filteredPending.length > 0 ? 3 : 2),
            }}
          >
            {selected ? (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "20px 22px" }}>
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                    <span style={{ display: "inline-flex", color: "var(--wds-primary)" }}>
                      <TinyIcon d="M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1" />
                    </span>
                    <span style={{ font: "700 20px/1.4 var(--wds-font-sans)", color: "var(--wds-label-normal)" }}>
                      {dateWithWeekday(kstDayKey(selected))} {timeAmPm(kstTime(selected))}
                    </span>
                    <span style={{ padding: "7px 12px", borderRadius: 999, background: "rgba(0,191,64,0.10)", font: "700 15px/1 var(--wds-font-sans)", color: "var(--wds-status-positive)" }}>
                      {filteredResponded.length}명 중 {selectedNames.length}명 가능
                    </span>
                  </div>
                  {selectedBlock && (
                    <span
                      style={{
                        font: "500 12px/1.4 var(--wds-font-sans)",
                        color: "var(--wds-primary-strong)",
                      }}
                    >
                      {selectedBlock.rank}순위 구간
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <PersonRow label="가능" labelColor="var(--wds-status-positive)" people={selectedNames} count={selectedNames.length} />
                  <PersonRow
                    label="안 됨"
                    labelColor="var(--wds-status-negative)"
                    people={selectedMissing}
                    count={selectedMissing.length}
                    strike
                  />
                  {filteredPending.length > 0 && (
                    <PersonRow
                      label="미응답"
                      labelColor="var(--wds-label-alternative)"
                      people={filteredPending}
                      count={filteredPending.length}
                      pending
                    />
                  )}
                </div>
              </>
            ) : (
              <span style={{ padding: "20px 22px", font: "400 14px/1.5 var(--wds-font-sans)", color: "var(--wds-label-alternative)" }}>
                칸에 마우스를 올리거나 탭하면 그 시간에 가능한 사람이 보여요
              </span>
            )}
          </div>
        </div>
      </div>

      {nudging && (
        <NudgeDialog
          count={pending.length}
          busy={busy}
          onClose={() => setNudging(false)}
          onSubmit={() => {
            setNudging(false);
            run(async () => {
              const result = await nudgeMeetingPoll(poll.id);
              if (!result.error) {
                show(poll.is_regular_session
                  ? `${pending.length}명에게 슬랙 DM 발송이 완료됐어요!`
                  : `${result.sent ?? 0}명에게 알림을 보냈어요`);
              }
              return result;
            });
          }}
        />
      )}

      {confirming && (
        <ConfirmDialog
          startIso={confirming.startIso}
          durationMin={confirming.durationMin}
          timeOptions={confirming.timeOptions}
          busy={busy}
          onStart={(startIso) => setConfirming({ ...confirming, startIso })}
          onDuration={(min) => setConfirming({ ...confirming, durationMin: min })}
          onClose={() => setConfirming(null)}
          onSubmit={() => {
            const target = confirming;
            setConfirming(null);
            run(() => target.backup
              ? applyBackupMeetingPoll(poll.id, target.startIso, target.durationMin)
              : confirmMeetingPoll(poll.id, target.startIso, target.durationMin));
          }}
        />
      )}
    </div>
  );
}

/** 버튼 안에 넣는 16px 선 아이콘. 어드민 사이드바와 같은 규격(stroke 1.75)이다. */
function TinyIcon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 16, height: 16, flexShrink: 0 }}
    >
      <path d={d} />
    </svg>
  );
}
