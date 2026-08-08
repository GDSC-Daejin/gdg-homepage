"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { respondAttendanceByToken, respondByToken } from "@/actions/meeting-poll";
import { Avatar } from "@/components/wds/Avatar";
import { Button } from "@/components/wds/Button";
import { Callout, ContentBadge } from "@/components/wds/primitives";
import { cellFromPoint, ScheduleGrid } from "@/components/wds/ScheduleGrid";
import {
  aggregate,
  avatarColor,
  avatarInitial,
  dateWithWeekday,
  durationLabel,
  HEAT_STEPS,
  heatStep,
  pollTimes,
  slotIso,
  timeAmPm,
  toViews,
  type Cell,
  type Participant,
} from "@/lib/meeting-poll";
import { availabilityViews, draftAvailability, type AvailabilityDrag } from "@/lib/meeting-poll-availability";

export interface GuestPoll {
  id: string;
  title: string;
  dates: string[];
  start_hour: number;
  end_hour: number;
  slot_min: number;
  due_at: string | null;
  confirmed_at: string | null;
  duration_min: number | null;
  response_mode?: "availability" | "attendance";
}

/**
 * 초대 링크 화면. 이름을 골라 자기 칸을 칠한다 — 로그인하지 않는다.
 * 원본에 이 화면 시안은 없어 상세 화면과 같은 규격·컴포넌트로 맞췄다.
 */
export function GuestRespond({
  token,
  poll,
  participants,
}: {
  token: string;
  poll: GuestPoll;
  participants: Participant[];
}) {
  const router = useRouter();
  const times = useMemo(
    () => pollTimes(poll.start_hour, poll.end_hour, poll.slot_min),
    [poll.start_hour, poll.end_hour, poll.slot_min],
  );
  const dates = poll.dates;
  const views = useMemo(() => toViews(participants), [participants]);

  const [meId, setMeId] = useState<string | null>(null);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<AvailabilityDrag | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [attendance, setAttendance] = useState<"attending" | "absent" | "undecided">("undecided");

  const locked =
    Boolean(poll.confirmed_at) ||
    Boolean(poll.due_at && Date.now() > Date.parse(poll.due_at));

  const draft = useMemo(() => draftAvailability(mine, drag, dates, times), [drag, mine, dates, times]);

  const liveViews = useMemo(() => availabilityViews(views, meId, draft, true), [views, meId, draft]);
  const responded = liveViews.filter((v) => v.responded);
  const available = useMemo(() => aggregate(liveViews), [liveViews]);

  function pick(id: string) {
    setMeId(id);
    setMine(new Set(views.find((v) => v.id === id)?.slots ?? []));
    setDone(false);
  }

  function startDrag(e: React.PointerEvent, cell: Cell) {
    if (!meId || locked) return;
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
    setDrag(null);
    setMine(draft);
  }

  function submit() {
    if (!meId) return;
    setError(undefined);
    setSaving(true);
    respondByToken(token, meId, [...mine])
      .then((result) => {
        if (result.error) setError(result.error);
        else {
          setDone(true);
          router.refresh();
        }
      })
      .finally(() => setSaving(false));
  }

  function submitAttendance() {
    if (!meId) return;
    setSaving(true);
    respondAttendanceByToken(token, meId, attendance)
      .then((result) => {
        if (result.error) setError(result.error);
        else { setDone(true); router.refresh(); }
      })
      .finally(() => setSaving(false));
  }

  if (poll.response_mode === "attendance") {
    return <div className="wds-surface" style={{ minHeight: "100dvh", padding: "28px 24px", fontFamily: "var(--wds-font-sans)" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <h1 style={{ margin: 0 }}>{poll.title}</h1>
        <p>참석 의사를 선택해주세요.</p>
        {views.map((view) => <button key={view.id} type="button" onClick={() => pick(view.id)} style={{ padding: 12, textAlign: "left", border: meId === view.id ? "2px solid var(--wds-primary)" : "1px solid var(--wds-line-neutral)", borderRadius: 8, background: "var(--wds-bg)" }}>{view.name}</button>)}
        {meId && !locked && <>
          <div style={{ display: "flex", gap: 8 }}>{(["attending", "absent", "undecided"] as const).map((value) => <Button key={value} type="button" size="medium" variant={attendance === value ? "solid" : "outlined"} color="primary" onClick={() => setAttendance(value)}>{({ attending: "참석", absent: "불참", undecided: "미정" })[value]}</Button>)}</div>
          <Button type="button" variant="solid" color="primary" size="large" onClick={submitAttendance} disabled={saving}>응답 저장</Button>
        </>}
        {done && <Callout tone="positive">저장했어요.</Callout>}
        {error && <Callout tone="negative">{error}</Callout>}
      </div>
    </div>;
  }

  return (
    <div
      className="wds-surface"
      style={{
        minHeight: "100dvh",
        background: "var(--wds-bg-alt)",
        fontFamily: "var(--wds-font-sans)",
        color: "var(--wds-label-normal)",
      }}
    >
      <div
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: "28px 24px 56px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1
              style={{
                margin: 0,
                font: "700 28px/1.35 var(--wds-font-sans)",
                letterSpacing: "-0.025em",
              }}
            >
              {poll.title}
            </h1>
            {poll.confirmed_at ? (
              <ContentBadge variant="solid" color="primary" size="medium">
                확정됨
              </ContentBadge>
            ) : locked ? (
              <ContentBadge variant="solid" color="neutral" size="medium">
                응답 마감
              </ContentBadge>
            ) : (
              <ContentBadge variant="solid" color="orange" size="medium">
                응답 받는 중
              </ContentBadge>
            )}
          </div>
          <p
            style={{
              margin: 0,
              font: "400 15px/1.5 var(--wds-font-sans)",
              color: "var(--wds-label-alternative)",
            }}
          >
            {dates[0]} ~ {dates[dates.length - 1]} · {poll.start_hour}시~{poll.end_hour}시 ·{" "}
            {poll.slot_min}분 단위
            {poll.due_at ? ` · ${dateWithWeekday(kstDayKey(poll.due_at))}까지` : ""}
          </p>
        </div>

        {poll.confirmed_at && (
          <Callout tone="primary" title="시간이 확정됐어요">
            {dateWithWeekday(kstDayKey(poll.confirmed_at))} {timeAmPm(kstTime(poll.confirmed_at))} ·{" "}
            {durationLabel(poll.duration_min ?? 0)}
          </Callout>
        )}
        {error && <Callout tone="negative">{error}</Callout>}
        {done && <Callout tone="positive" title="저장했어요">언제든 다시 들어와 고칠 수 있어요.</Callout>}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            padding: "22px 24px 24px",
            background: "var(--wds-bg)",
            borderRadius: 16,
            boxShadow: "var(--wds-shadow-card)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ font: "700 18px/1.4 var(--wds-font-sans)" }}>본인 이름을 골라주세요</span>
            <span
              style={{
                font: "400 13px/1.5 var(--wds-font-sans)",
                color: "var(--wds-label-alternative)",
              }}
            >
              고르면 그 아래 격자에 가능한 시간을 칠할 수 있어요
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {views.map((v) => {
              const on = v.id === meId;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => pick(v.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    height: 36,
                    padding: "0 12px 0 5px",
                    borderRadius: 999,
                    border: "none",
                    cursor: "pointer",
                    background: on ? "var(--wds-primary-bg)" : "var(--wds-bg)",
                    boxShadow: `inset 0 0 0 1px ${
                      on ? "rgba(0,102,255,0.32)" : "var(--wds-line-normal)"
                    }`,
                    font: `${on ? 600 : 500} 14px/1 var(--wds-font-sans)`,
                    color: on ? "var(--wds-primary-strong)" : "var(--wds-label-neutral)",
                  }}
                >
                  <Avatar
                    initial={avatarInitial(v.name)}
                    color={avatarColor(v.name)}
                    size={26}
                    avatarPath={v.avatarPath}
                  />
                  {v.name}
                  {v.responded && (
                    <span
                      style={{
                        font: "500 12px/1 var(--wds-font-sans)",
                        color: "var(--wds-status-positive)",
                      }}
                    >
                      응답함
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 32,
            padding: "24px 28px 28px",
            background: "var(--wds-bg)",
            borderRadius: 16,
            boxShadow: "var(--wds-shadow-card)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <h3 style={{ margin: 0, font: "700 18px/1.4 var(--wds-font-sans)" }}>
                  내가 가능한 시간
                </h3>
                <p
                  style={{
                    margin: 0,
                    font: "400 13px/1.5 var(--wds-font-sans)",
                    color: "var(--wds-label-alternative)",
                  }}
                >
                  {!meId
                    ? "위에서 이름을 먼저 골라주세요"
                    : locked
                      ? "지금은 수정할 수 없어요"
                      : "칸을 끌어서 칠하세요. 칠한 칸에서 시작하면 지워져요"}
                </p>
              </div>
              <Button
                variant="solid"
                color="primary"
                size="small"
                disabled={!meId || locked || saving}
                onClick={submit}
              >
                {saving ? "저장 중…" : "저장하기"}
              </Button>
            </div>
            <ScheduleGrid
              dates={dates}
              times={times}
              slotMin={poll.slot_min}
              interactive={Boolean(meId) && !locked}
              onCellPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              cell={({ dateIndex, timeIndex }) => ({
                background: draft.has(slotIso(dates[dateIndex], times[timeIndex]))
                  ? "var(--wds-primary)"
                  : "var(--wds-bg)",
              })}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <h3 style={{ margin: 0, font: "700 18px/1.4 var(--wds-font-sans)" }}>
                전체 가능한 시간
              </h3>
              <p
                style={{
                  margin: 0,
                  font: "400 13px/1.5 var(--wds-font-sans)",
                  color: "var(--wds-label-alternative)",
                }}
              >
                진할수록 많이 겹쳐요. 지금 {responded.length}명이 응답했어요
              </p>
            </div>
            <ScheduleGrid
              dates={dates}
              times={times}
              slotMin={poll.slot_min}
              cell={({ dateIndex, timeIndex }) => {
                const slot = slotIso(dates[dateIndex], times[timeIndex]);
                const count = available.get(slot)?.length ?? 0;
                return { background: HEAT_STEPS[heatStep(count, responded.length)] };
              }}
            />
          </div>
        </div>
      </div>
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

function kstTime(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}
