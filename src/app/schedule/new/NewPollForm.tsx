"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createMeetingPoll, updateMeetingPoll } from "@/actions/meeting-poll";
import { Avatar } from "@/components/wds/Avatar";
import { Button } from "@/components/wds/Button";
import {
  Callout,
  Chip,
  SegmentedControl,
  SelectBox,
  Switch,
  TextField,
} from "@/components/wds/primitives";
import { ScheduleGrid } from "@/components/wds/ScheduleGrid";
import styles from "../schedule.module.css";
import { monthGrid } from "@/lib/calendar";
import {
  avatarInitial,
  AVATAR_COLORS,
  dateWithWeekday,
  pollTimes,
  SLOT_UNITS,
  suggestPollTitle,
  weekdayColor,
} from "@/lib/meeting-poll";
import type { MeetingPoll } from "@/lib/types";
import { addPollDraftPerson, defaultPollDates, dueAtEnd, pollDueOptions, setPollDateSelection, type PollDraftPerson } from "./poll-draft";

export interface MemberOption {
  id: string;
  name: string;
  avatarPath: string | null;
}

type Picked = PollDraftPerson;

export interface EditableParticipant {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
}

const RANGE_PRESETS = [
  { key: "work", label: "업무시간 9~18시", start: 9, end: 18 },
  { key: "evening", label: "저녁 18~24시", start: 18, end: 24 },
  { key: "allday", label: "하루 종일", start: 0, end: 24 },
] as const;

const HOURS = Array.from({ length: 25 }, (_, hour) => hour);

export function NewPollForm({
  today,
  members,
  inviteToken,
  edit,
}: {
  today: string;
  members: MemberOption[];
  /** 새 일정에 붙일 고유 토큰. 초대 링크로는 노출하지 않는다. */
  inviteToken: string;
  edit?: { poll: MeetingPoll; participants: EditableParticipant[] };
}) {
  const router = useRouter();
  // 제목은 날짜에서 지어 미리 채워 둔다(원본도 값이 들어가 있다). 한 번 손대면 따라가지 않는다.
  const [typedTitle, setTypedTitle] = useState<string | null>(edit?.poll.title ?? null);
  const [dates, setDates] = useState<string[]>(() => edit?.poll.dates ?? defaultPollDates(today));
  const [startHour, setStartHour] = useState(edit?.poll.start_hour ?? 9);
  const [endHour, setEndHour] = useState(edit?.poll.end_hour ?? 23);
  const [slotMin, setSlotMin] = useState<number>(edit?.poll.slot_min ?? 30);
  const [people, setPeople] = useState<Picked[]>(() =>
    edit
      ? edit.participants.map((p) => ({
          key: p.id,
          participantId: p.id,
          name: p.name,
          userId: p.user_id,
          email: p.email,
          avatarPath: members.find((member) => member.id === p.user_id)?.avatarPath ?? null,
        }))
      : [],
  );
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [dueAt, setDueAt] = useState<string | null>(edit?.poll.due_at ?? null);
  const [notifyBeforeDue, setNotifyBeforeDue] = useState(edit?.poll.notify_before_due ?? true);
  const [isMojisoop, setIsMojisoop] = useState(edit?.poll.is_mojisoop ?? true);
  const [isRegularSession, setIsRegularSession] = useState(edit?.poll.is_regular_session ?? false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);
  const [dragMode, setDragMode] = useState<boolean | null>(null);

  const sorted = useMemo(() => [...dates].sort(), [dates]);
  const times = useMemo(
    () => pollTimes(startHour, endHour, slotMin),
    [startHour, endHour, slotMin],
  );
  const suggestion = sorted.length
    ? suggestPollTitle(sorted[0], sorted[sorted.length - 1])
    : "";
  const title = typedTitle ?? suggestion;
  const activePreset = RANGE_PRESETS.find((p) => p.start === startHour && p.end === endHour);
  const memberSuggestions = useMemo(
    () => members.filter((member) =>
      !people.some((person) => person.userId === member.id) && member.name.includes(draftName.trim()),
    ),
    [draftName, members, people],
  );
  // 원본의 "6명 이상 응답하면" = 초대 7명의 80%. 같은 식으로 문턱을 잡는다.
  const recommendGate = Math.max(2, Math.ceil(people.length * 0.8));

  const month = (edit?.poll.dates[0] ?? today).slice(0, 7);

  function selectDraggedDate(dateKey: string, selected: boolean) {
    setDates((prev) => setPollDateSelection(prev, [dateKey], selected));
  }

  useEffect(() => {
    const endDrag = () => setDragMode(null);
    window.addEventListener("pointerup", endDrag);
    return () => window.removeEventListener("pointerup", endDrag);
  }, []);

  function addPerson() {
    const value = draftName.trim();
    if (!value) {
      setAdding(false);
      return;
    }
    setPeople((prev) => addPollDraftPerson(prev, value, members));
    setDraftName("");
  }

  function submit() {
    setError(undefined);
    setPending(true);
    const input = {
      title: (title || suggestion).trim(),
      dates: sorted,
      startHour,
      endHour,
      slotMin,
      dueAt: dueValue || null,
      notifyBeforeDue,
      isMojisoop,
      isRegularSession,
      memberIds: people.filter((p) => p.userId).map((p) => p.userId as string),
    };
    const request = edit
      ? updateMeetingPoll(edit.poll.id, {
          ...input,
          participants: people.map((p) => ({
            id: p.participantId,
            userId: p.userId,
            name: p.name,
            email: p.email,
          })),
        })
      : createMeetingPoll({ ...input, inviteToken });
    request
      .then((result) => {
        if (result.error) {
          setError(result.error);
          setPending(false);
          return;
        }
        router.push(edit ? `/schedule/${edit.poll.id}` : `/schedule/${"id" in result ? result.id : ""}`);
      })
      .catch(() => setPending(false));
  }

  // 마감 후보는 오늘부터 마지막 후보 날짜까지의 자정. 원본처럼 후보 기간 안에도 걸 수 있다.
  const dueOptions = useMemo(() => pollDueOptions(today, sorted), [sorted, today]);

  // 기본 마감은 두 번째 후보 날짜 자정 — 원본 시안도 시작(7/30) 다음 날인 7/31 자정이다.
  const defaultDue = sorted.length ? dueAtEnd(sorted[Math.min(1, sorted.length - 1)]) : "";
  const dueValue = dueAt ?? defaultDue;

  return (
    <div className={styles.page}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <h1 style={{ margin: 0, font: "700 28px/1.35 var(--wds-font-sans)", letterSpacing: "-0.025em" }}>
          {edit ? "일정 수정" : "새 일정 만들기"}
        </h1>
        <p
          style={{
            margin: 0,
            font: "400 15px/1.5 var(--wds-font-sans)",
            color: "var(--wds-label-alternative)",
          }}
        >
          {edit
            ? "후보를 바꾸면 새 시간에도 유효한 응답만 유지해요."
            : "날짜와 시간 범위만 정하면돼요. 나머지는 참여자가 스스로 응답해요."}
        </p>
      </div>

      {(error || notice) && (
        <Callout tone={error ? "negative" : "primary"}>{error ?? notice}</Callout>
      )}

      <div className={styles.newPollLayout}>
        {/* ── 왼쪽 ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 20,
              padding: "24px 26px 26px",
              background: "var(--wds-bg)",
              borderRadius: 16,
              boxShadow: "var(--wds-shadow-card)",
            }}
          >
            <TextField
              label="일정 이름"
              value={title}
              placeholder={suggestion}
              onChange={(e) => setTypedTitle(e.target.value)}
              onKeyDown={(e) => {
                // 지우고 Tab을 누르면 날짜에서 지은 제목으로 되돌린다.
                if (e.key === "Tab" && !e.shiftKey && !title) setTypedTitle(null);
              }}
            />

            <div style={{ height: 1, background: "var(--wds-line-alternative)" }} />

            {/* 날짜 고르기 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ font: "600 15px/1.4 var(--wds-font-sans)", color: "var(--wds-label-normal)" }}>
                  날짜 고르기
                </span>
              </div>
              <div className={styles.monthGrid}>
                <MonthPicker
                  month={month}
                  selected={dates}
                  dragMode={dragMode}
                  onPointerDown={(dateKey, selected) => {
                    setDragMode(selected);
                    selectDraggedDate(dateKey, selected);
                  }}
                  onPointerEnter={(dateKey) => {
                    if (dragMode !== null) selectDraggedDate(dateKey, dragMode);
                  }}
                />
              </div>
            </div>

            <div style={{ height: 1, background: "var(--wds-line-alternative)" }} />

            {/* 시간 범위 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={{ font: "600 15px/1.4 var(--wds-font-sans)", color: "var(--wds-label-normal)" }}>
                시간 범위
              </span>
              <div className={styles.rangePresets}>
                {RANGE_PRESETS.map((preset) => (
                  <Chip
                    key={preset.key}
                    active={activePreset?.key === preset.key}
                    onClick={() => {
                      setStartHour(preset.start);
                      setEndHour(preset.end);
                    }}
                  >
                    {preset.label}
                  </Chip>
                ))}
              </div>
              <div className={styles.timeRangeFields}>
                <SelectBox
                  label="시작"
                  value={String(startHour)}
                  options={HOURS.slice(0, 24).map((h) => ({
                    value: String(h),
                    label: `${String(h).padStart(2, "0")}:00`,
                  }))}
                  onChange={(v) => {
                    const next = Number(v);
                    setStartHour(next);
                    if (next >= endHour) setEndHour(Math.min(24, next + 1));
                  }}
                />
                <SelectBox
                  label="종료"
                  value={String(endHour)}
                  options={HOURS.slice(1).map((h) => ({
                    value: String(h),
                    label: h === 24 ? "24:00" : `${String(h).padStart(2, "0")}:00`,
                  }))}
                  onChange={(v) => {
                    const next = Number(v);
                    setEndHour(next);
                    if (next <= startHour) setStartHour(Math.max(0, next - 1));
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span
                    style={{
                      font: "500 13px/1.4 var(--wds-font-sans)",
                      color: "var(--wds-label-neutral)",
                    }}
                  >
                    단위
                  </span>
                  <SegmentedControl
                    items={SLOT_UNITS.map((unit) => ({
                      key: String(unit),
                      label: unit === 30 ? "30분" : "1시간",
                    }))}
                    value={String(slotMin)}
                    onChange={(key) => setSlotMin(Number(key))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 참여자 초대 */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              padding: "24px 26px 26px",
              background: "var(--wds-bg)",
              borderRadius: 16,
              boxShadow: "var(--wds-shadow-card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ font: "600 15px/1.4 var(--wds-font-sans)", color: "var(--wds-label-normal)" }}>
                참여자 초대{" "}
                <span style={{ color: "var(--wds-label-alternative)", fontWeight: 500 }}>
                  {people.length}명
                </span>
              </span>
              <span
                style={{
                  font: "500 13px/1.4 var(--wds-font-sans)",
                  color: "var(--wds-label-alternative)",
                }}
              >
                활성 회원만 추가할 수 있어요
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Chip
                active={members.length > 0 && people.length === members.length}
                onClick={() => setPeople(members.map((member) => ({
                  key: member.id,
                  participantId: null,
                  name: member.name,
                  userId: member.id,
                  email: null,
                  avatarPath: member.avatarPath,
                })))}
              >
                전원
              </Chip>
              {people.map((p) => (
                <span
                  key={p.key}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    height: 34,
                    padding: "0 8px 0 4px",
                    borderRadius: 999,
                    background: "var(--wds-fill-alternative)",
                    boxShadow: "inset 0 0 0 1px var(--wds-line-alternative)",
                  }}
                >
                  <Avatar
                    initial={avatarInitial(p.name)}
                    color={AVATAR_COLORS[people.indexOf(p) % AVATAR_COLORS.length]}
                    size={26}
                    avatarPath={p.avatarPath}
                  />
                  <span
                    style={{
                      font: "500 14px/1 var(--wds-font-sans)",
                      color: "var(--wds-label-neutral)",
                    }}
                  >
                    {p.name}
                  </span>
                  <button
                    type="button"
                    aria-label={`${p.name} 제외`}
                    onClick={() => setPeople((prev) => prev.filter((x) => x.key !== p.key))}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      font: "400 15px/1 var(--wds-font-sans)",
                      color: "var(--wds-label-assistive)",
                      padding: "0 3px",
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              {adding ? (
                <div style={{ position: "relative", minWidth: 280 }}>
                  <input
                    autoFocus
                    value={draftName}
                    placeholder="회원 이름"
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={addPerson}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addPerson();
                      }
                      if (e.key === "Escape") {
                        setDraftName("");
                        setAdding(false);
                      }
                    }}
                    style={{
                      width: "100%",
                      height: 48,
                      padding: "0 16px",
                      boxSizing: "border-box",
                      borderRadius: 10,
                      border: "none",
                      outline: "none",
                      boxShadow: "inset 0 0 0 1.5px var(--wds-primary)",
                      font: "500 16px/1 var(--wds-font-sans)",
                      color: "var(--wds-label-normal)",
                    }}
                  />
                  {memberSuggestions.length > 0 && (
                    <div
                      role="listbox"
                      aria-label="활성 회원"
                      style={{
                        position: "absolute",
                        zIndex: 1,
                        top: "calc(100% + 6px)",
                        width: "100%",
                        maxHeight: 240,
                        overflowY: "auto",
                        padding: 6,
                        boxSizing: "border-box",
                        borderRadius: 10,
                        background: "var(--wds-bg)",
                        boxShadow: "var(--wds-shadow-card)",
                      }}
                    >
                      {memberSuggestions.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          role="option"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            setPeople((prev) => addPollDraftPerson(prev, member.name, members));
                            setDraftName("");
                            setAdding(false);
                          }}
                          style={{
                            display: "flex",
                            width: "100%",
                            height: 40,
                            alignItems: "center",
                            padding: "0 10px",
                            border: "none",
                            borderRadius: 6,
                            background: "transparent",
                            color: "var(--wds-label-normal)",
                            cursor: "pointer",
                            font: "500 15px/1 var(--wds-font-sans)",
                            textAlign: "left",
                          }}
                        >
                          {member.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    height: 34,
                    padding: "0 14px",
                    borderRadius: 999,
                    border: "none",
                    background: "transparent",
                    boxShadow: "inset 0 0 0 1px var(--wds-line-normal)",
                    font: "500 14px/1 var(--wds-font-sans)",
                    color: "var(--wds-label-alternative)",
                    cursor: "pointer",
                  }}
                >
                  + 회원 추가
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── 오른쪽 레일 ── */}
        <div className={styles.newPollAside} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              padding: "22px 22px 24px",
              background: "var(--wds-bg)",
              borderRadius: 16,
              boxShadow: "var(--wds-shadow-card)",
            }}
          >
            {sorted.length > 0 && times.length > 0 ? (
              <ScheduleGrid
                dates={sorted}
                times={times}
                slotMin={slotMin}
                labelWidth={34}
                rowHeight={17}
                labelKind="short"
                header="weekday"
                cell={() => ({ background: "var(--wds-bg)" })}
              />
            ) : (
              <span
                style={{
                  font: "400 13px/1.5 var(--wds-font-sans)",
                  color: "var(--wds-label-assistive)",
                }}
              >
                날짜와 시간 범위를 고르면 격자가 보여요
              </span>
            )}
          </div>

          <Callout tone="primary" icon="circle-info" title="로그인 없이 응답할 수 있어요">
            링크를 받은 사람은 이름만 적고 바로 시간을 칠할 수 있어요. {recommendGate}명 이상
            응답하면 추천 시간을 알려드려요.
          </Callout>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              padding: "20px 22px 22px",
              background: "var(--wds-bg)",
              borderRadius: 16,
              boxShadow: "var(--wds-shadow-card)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span
                  style={{
                    font: "600 14px/1.4 var(--wds-font-sans)",
                    color: "var(--wds-label-normal)",
                  }}
                >
                  모지숲 일정
                </span>
                <span
                  style={{
                    font: "400 12px/1.4 var(--wds-font-sans)",
                    color: "var(--wds-label-alternative)",
                  }}
                >
                  끄면 응답 요청을 참여자 DM으로 보내요
                </span>
              </div>
              <Switch
                checked={isMojisoop}
                onChange={(checked) => {
                  setIsMojisoop(checked);
                  if (checked) setIsRegularSession(false);
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span
                  style={{
                    font: "600 14px/1.4 var(--wds-font-sans)",
                    color: "var(--wds-label-normal)",
                  }}
                >
                  정기세션 일정
                </span>
                <span
                  style={{
                    font: "400 12px/1.4 var(--wds-font-sans)",
                    color: "var(--wds-label-alternative)",
                  }}
                >
                  확정하면 정기세션 이벤트를 만들어요
                </span>
              </div>
              <Switch
                checked={isRegularSession}
                onChange={(checked) => {
                  setIsRegularSession(checked);
                  if (checked) setIsMojisoop(false);
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span
                  style={{
                    font: "600 14px/1.4 var(--wds-font-sans)",
                    color: "var(--wds-label-normal)",
                  }}
                >
                  마감 전날 알림 보내기
                </span>
                <span
                  style={{
                    font: "400 12px/1.4 var(--wds-font-sans)",
                    color: "var(--wds-label-alternative)",
                  }}
                >
                  안 한 사람에게만 한 번 보내요
                </span>
              </div>
              <Switch
                checked={notifyBeforeDue}
                disabled={!dueValue}
                onChange={setNotifyBeforeDue}
              />
            </div>
            <SelectBox
              label="응답 마감"
              value={dueValue}
              placeholder="마감 없음"
              options={dueOptions}
              onChange={setDueAt}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Button
              variant="solid"
              color="primary"
              size="large"
              fullWidth
              disabled={pending}
              onClick={submit}
            >
              {pending ? (edit ? "저장 중…" : "만드는 중…") : edit ? "변경사항 저장" : "일정 만들고 링크 받기"}
            </Button>
            <Button
              variant="text"
              color="assistive"
              size="medium"
              fullWidth
              onClick={() => router.push(edit ? `/schedule/${edit.poll.id}` : "/schedule")}
            >
              취소
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const DOW = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 날짜 후보를 고르는 한 달 달력. */
function MonthPicker({
  month,
  selected,
  dragMode,
  onPointerDown,
  onPointerEnter,
}: {
  month: string;
  selected: string[];
  dragMode: boolean | null;
  onPointerDown: (dateKey: string, selected: boolean) => void;
  onPointerEnter: (dateKey: string) => void;
}) {
  const grid = monthGrid(month);
  const [year, mon] = month.split("-").map(Number);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "min(100%, 520px)",
        gap: 12,
        padding: 20,
        borderRadius: 16,
        boxShadow: "inset 0 0 0 1px var(--wds-line-alternative)",
      }}
    >
      <span
        style={{
          font: "600 18px/1.4 var(--wds-font-sans)",
          color: "var(--wds-label-normal)",
          textAlign: "center",
        }}
      >
        {year}년 {mon}월
      </span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", columnGap: 0, rowGap: 4 }}>
        {DOW.map((w) => (
          <span
            key={w}
            style={{
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              font: "500 13px/1 var(--wds-font-sans)",
              color: w === "일" ? "var(--wds-accent-red)" : w === "토" ? "var(--wds-accent-blue)" : "var(--wds-label-assistive)",
            }}
          >
            {w}
          </span>
        ))}
        {grid.map((dateKey, index) => {
          const inMonth = dateKey.startsWith(month);
          const on = selected.includes(dateKey);
          const previousOn = grid[index - 1]?.startsWith(month) && selected.includes(grid[index - 1]);
          const nextOn = grid[index + 1]?.startsWith(month) && selected.includes(grid[index + 1]);
          if (!inMonth) return <span key={dateKey} style={{ height: 44 }} />;
          return (
            <button
              key={dateKey}
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                onPointerDown(dateKey, !on);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onPointerDown(dateKey, !on);
                }
              }}
              onPointerEnter={() => {
                if (dragMode !== null) onPointerEnter(dateKey);
              }}
              aria-pressed={on}
              aria-label={`${dateWithWeekday(dateKey)} ${on ? "선택 해제" : "선택"}`}
              style={{
                height: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                borderRadius: `${previousOn ? 0 : 10}px ${nextOn ? 0 : 10}px ${nextOn ? 0 : 10}px ${previousOn ? 0 : 10}px`,
                cursor: "pointer",
                background: on ? "var(--wds-primary)" : "transparent",
                color: on ? "#fff" : weekdayColor(dateKey),
                font: `${on ? 700 : 400} 17px/1 var(--wds-font-sans)`,
              }}
            >
              {Number(dateKey.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
