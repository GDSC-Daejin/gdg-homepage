// 회의 시간 조율 격자·집계·추천 계산. 한국은 서머타임이 없어 KST를 고정 +09:00으로 다룬다.
import { diffDays, nextDayKey } from "@/lib/calendar";

const KST = "+09:00";

/** 고를 수 있는 칸 단위(분). 원본 디자인의 SegmentedControl 두 항목. */
export const SLOT_UNITS = [30, 60] as const;
export type SlotUnit = (typeof SLOT_UNITS)[number];

export interface MeetingPollInput {
  title: string;
  dates: string[];
  startHour: number;
  endHour: number;
  slotMin: number;
  dueAt: string | null;
  notifyBeforeDue: boolean;
}

/** 후보 날짜 최대 개수. 격자 폭 상한이자 마이그레이션 0056의 check와 같은 값. */
export const MAX_POLL_DAYS = 14;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** 생성·수정 action이 공통으로 받는 후보·시간 입력을 신뢰할 수 있게 만든다. */
export function prepareMeetingPollInput(
  input: MeetingPollInput,
): { value: MeetingPollInput } | { error: string } {
  const title = input.title.trim();
  const dates = [...new Set(input.dates)].filter((date) => DAY.test(date)).sort();

  if (!title) return { error: "일정 이름을 입력해주세요" };
  if (dates.length === 0) return { error: "날짜를 하나 이상 고르세요" };
  if (dates.length > MAX_POLL_DAYS) {
    return { error: `날짜는 ${MAX_POLL_DAYS}일까지만 고를 수 있어요` };
  }
  if (!Number.isInteger(input.startHour) || input.startHour < 0 || input.startHour > 23) {
    return { error: "시작 시간을 선택해주세요" };
  }
  if (!Number.isInteger(input.endHour) || input.endHour < 1 || input.endHour > 24) {
    return { error: "종료 시간을 선택해주세요" };
  }
  if (input.endHour <= input.startHour) {
    return { error: "종료 시간이 시작 시간보다 늦어야 해요" };
  }
  if (!SLOT_UNITS.includes(input.slotMin as SlotUnit)) {
    return { error: "칸 단위를 선택해주세요" };
  }
  if (input.dueAt && Number.isNaN(Date.parse(input.dueAt))) {
    return { error: "응답 마감을 다시 선택해주세요" };
  }

  return { value: { ...input, title, dates } };
}

/** 확정 모달의 소요시간 선택지(분). */
export const DURATION_OPTIONS = [30, 60, 90, 120] as const;

/** 추천 구간의 최소 길이(분). 1시간 30분은 겹치는 구간이 잘 안 나와서 1시간으로 완화했다. */
export const MIN_BLOCK_MIN = 60;

/** 원본 디자인의 히트맵 7단계. 0명 → 전원 순. */
export const HEAT_STEPS = [
  "var(--wds-bg)",
  "rgba(0,102,255,0.10)",
  "rgba(0,102,255,0.20)",
  "rgba(0,102,255,0.34)",
  "rgba(0,102,255,0.50)",
  "rgba(0,102,255,0.72)",
  "rgb(0,102,255)",
] as const;

/** 아바타 색 팔레트 — 원본 목업이 쓴 8색(WDS accent). */
export const AVATAR_COLORS = [
  "rgb(101,65,242)",
  "rgb(255,71,133)",
  "rgb(0,152,178)",
  "rgb(255,153,0)",
  "rgb(0,191,64)",
  "rgb(0,94,235)",
  "rgb(151,71,255)",
  "rgb(255,66,66)",
] as const;

/**
 * 이름에서 아바타 색을 정한다. 저장하지 않고 매번 같은 값이 나오게 뽑는다 —
 * 컬럼을 하나 늘리는 대신 이름이 같으면 항상 같은 색이면 충분하다.
 */
export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * 아바타에 넣을 한 글자. "Jayden(옥지훈)"처럼 괄호가 있으면 괄호 안 성을 쓴다 —
 * 원본 목업이 "옥"으로 보여주기 때문이다.
 */
export function avatarInitial(name: string): string {
  const paren = name.match(/\(([^)]+)\)/);
  const base = (paren ? paren[1] : name).trim();
  return base.slice(0, 1) || "?";
}

/** 격자 행: start_hour부터 end_hour(배타)까지 unit 간격 "HH:mm" 배열. */
export function pollTimes(startHour: number, endHour: number, unit: number): string[] {
  const times: string[] = [];
  for (let min = startHour * 60; min < endHour * 60; min += unit) {
    times.push(`${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`);
  }
  return times;
}

/** starts~ends 사이의 모든 날짜. 폴 생성 화면의 "이 범위 전체 고르기"용. */
export function dateRange(startsOn: string, endsOn: string): string[] {
  const dates: string[] = [];
  for (let day = startsOn; day <= endsOn; day = nextDayKey(day)) {
    dates.push(day);
    if (dates.length > MAX_POLL_DAYS) break;
  }
  return dates;
}

/** "YYYY-MM-DD" + "HH:mm"(KST) → 슬롯 ISO. 슬롯의 정체는 이 문자열 하나다. */
export function slotIso(dateKey: string, time: string): string {
  return new Date(`${dateKey}T${time}:00${KST}`).toISOString();
}

/**
 * Postgres timestamptz는 "2026-08-03 10:00:00+00" 처럼 돌아와 slotIso와 문자열이 다르다.
 * 비교 전에 한 번 ISO로 통일한다.
 */
export function normalizeSlots(slots: string[]): string[] {
  return slots.map((slot) => new Date(slot).toISOString());
}

export interface Participant {
  id: string;
  /** 우리 회원이면 profiles.id, 초대만 된 사람이면 null */
  user_id: string | null;
  name: string;
  email: string | null;
  slots: string[];
  responded_at: string | null;
  /** 회원이면 profiles.avatar_path. 초대만 된 사람은 없다. */
  avatar_path?: string | null;
}

/** 화면에 그릴 때 쓰는 참여자 — 아바타 색·이니셜까지 계산해 붙인 것. */
export interface ParticipantView {
  id: string;
  name: string;
  initial: string;
  color: string;
  avatarPath: string | null;
  responded: boolean;
  slots: Set<string>;
}

/**
 * 색은 명단 순서로 배정한다 — 원본 목업의 색 순서(violet·pink·cyan·orange·green·blue)와
 * 같아지고, 한 폴 안에서 색이 겹치지 않는다. 이름 해시로 뽑으면 겹칠 수 있다.
 */
export function toViews(participants: Participant[]): ParticipantView[] {
  return participants.map((p, index) => ({
    id: p.id,
    name: p.name,
    initial: avatarInitial(p.name),
    color: AVATAR_COLORS[index % AVATAR_COLORS.length],
    avatarPath: p.avatar_path ?? null,
    responded: Boolean(p.responded_at),
    slots: new Set(normalizeSlots(p.slots)),
  }));
}

/** 슬롯 ISO → 그 시간에 가능한 사람 목록. 응답한 사람만 센다. */
export function aggregate(views: ParticipantView[]): Map<string, ParticipantView[]> {
  const map = new Map<string, ParticipantView[]>();
  for (const view of views) {
    if (!view.responded) continue;
    for (const slot of view.slots) {
      const bucket = map.get(slot);
      if (bucket) bucket.push(view);
      else map.set(slot, [view]);
    }
  }
  return map;
}

/**
 * 히트맵 농도 0~6. 원본은 응답자 6명 기준으로 인원수를 그대로 색인했다 —
 * 응답자 수가 몇이든 같은 7단계에 눌러 담고, 6명일 때는 원본과 정확히 같아진다.
 */
export function heatStep(count: number, total: number): number {
  if (count <= 0 || total <= 0) return 0;
  return Math.max(1, Math.min(6, Math.round((count / total) * 6)));
}

export interface Cell {
  dateIndex: number;
  timeIndex: number;
}

/** 드래그 시작 칸과 현재 칸이 만드는 사각 영역의 슬롯 ISO들. */
export function rectSlots(
  dates: string[],
  times: string[],
  anchor: Cell,
  cursor: Cell,
): string[] {
  const slots: string[] = [];
  for (
    let d = Math.min(anchor.dateIndex, cursor.dateIndex);
    d <= Math.max(anchor.dateIndex, cursor.dateIndex);
    d++
  ) {
    for (
      let t = Math.min(anchor.timeIndex, cursor.timeIndex);
      t <= Math.max(anchor.timeIndex, cursor.timeIndex);
      t++
    ) {
      if (dates[d] && times[t]) slots.push(slotIso(dates[d], times[t]));
    }
  }
  return slots;
}

/** 폴 격자에 실제로 존재하는 슬롯 전체. 클라이언트가 보낸 응답을 검증할 때 쓴다. */
export function pollSlotSet(poll: {
  dates: string[];
  start_hour: number;
  end_hour: number;
  slot_min: number;
}): Set<string> {
  const times = pollTimes(poll.start_hour, poll.end_hour, poll.slot_min);
  return new Set(poll.dates.flatMap((date) => times.map((time) => slotIso(date, time))));
}

/** 후보를 바꾼 뒤에도 새 칸 전체가 기존 응답으로 덮이면 그 응답을 유지한다. */
export function remapAvailabilitySlots(
  slots: string[],
  oldSlotMin: number,
  nextPoll: {
    dates: string[];
    start_hour: number;
    end_hour: number;
    slot_min: number;
  },
): string[] {
  const ranges = normalizeSlots(slots)
    .map((slot) => {
      const start = Date.parse(slot);
      return { start, end: start + oldSlotMin * 60_000 };
    })
    .sort((a, b) => a.start - b.start)
    .reduce<{ start: number; end: number }[]>((merged, range) => {
      const previous = merged.at(-1);
      if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
      else merged.push(range);
      return merged;
    }, []);

  return [...pollSlotSet(nextPoll)].filter((slot) => {
    const start = Date.parse(slot);
    const end = start + nextPoll.slot_min * 60_000;
    return ranges.some((range) => range.start <= start && range.end >= end);
  });
}

/* ---------------- 추천 구간 ---------------- */

export interface Recommendation {
  rank: number;
  dateIndex: number;
  /** 격자 행 index. from~to 양끝 포함. */
  from: number;
  to: number;
  startIso: string;
  durationMin: number;
  /** 구간 전체가 가능한 사람 */
  available: ParticipantView[];
  /** 응답했지만 구간 전체는 안 되는 사람 */
  missing: ParticipantView[];
}

/**
 * 가장 많이 겹치는 연속 구간 top N.
 * 구간 길이는 MIN_BLOCK_MIN을 채우는 최소 칸 수로 고정하고(30분 단위면 2칸),
 * "구간의 모든 칸이 가능한 사람" 수로 줄을 세운다. 겹치는 구간은 하나만 남긴다.
 */
export function recommendBlocks(
  dates: string[],
  times: string[],
  views: ParticipantView[],
  slotMin: number,
  topCount = 3,
): Recommendation[] {
  const responded = views.filter((v) => v.responded);
  if (responded.length === 0) return [];

  const span = Math.max(1, Math.ceil(MIN_BLOCK_MIN / slotMin));
  if (times.length < span) return [];

  const candidates: { dateIndex: number; from: number; to: number; available: ParticipantView[] }[] = [];
  for (let d = 0; d < dates.length; d++) {
    for (let from = 0; from + span - 1 < times.length; from++) {
      const to = from + span - 1;
      const available = responded.filter((p) => {
        for (let t = from; t <= to; t++) {
          if (!p.slots.has(slotIso(dates[d], times[t]))) return false;
        }
        return true;
      });
      if (available.length > 0) candidates.push({ dateIndex: d, from, to, available });
    }
  }

  // 인원 많은 순 → 이른 날짜 → 이른 시각. 같은 조건이면 앞선 구간이 이긴다.
  candidates.sort(
    (a, b) =>
      b.available.length - a.available.length ||
      a.dateIndex - b.dateIndex ||
      a.from - b.from,
  );

  const picked: Recommendation[] = [];
  for (const c of candidates) {
    if (picked.length >= topCount) break;
    const overlaps = picked.some(
      (p) => p.dateIndex === c.dateIndex && c.from <= p.to && c.to >= p.from,
    );
    if (overlaps) continue;
    picked.push({
      rank: picked.length + 1,
      dateIndex: c.dateIndex,
      from: c.from,
      to: c.to,
      startIso: slotIso(dates[c.dateIndex], times[c.from]),
      durationMin: span * slotMin,
      available: c.available,
      missing: responded.filter((p) => !c.available.includes(p)),
    });
  }
  return picked;
}

/* ---------------- 표기 ---------------- */

/** "HH:mm" → "오후 7:30". 자정은 "자정". 원본 목업의 fmt()와 같은 규칙. */
export function timeAmPm(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (h === 24 || (h === 0 && m === 0)) return "자정";
  if (h === 0) return `오전 12:${pad(m)}`;
  if (h < 12) return `오전 ${h}:${pad(m)}`;
  if (h === 12) return `오후 12:${pad(m)}`;
  return `오후 ${h - 12}:${pad(m)}`;
}

/** 격자 시작 시각에서 offset분 뒤의 "오후 9:00" 표기. 구간 종료 시각 표기용. */
export function timeAmPmFromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  return timeAmPm(`${pad(h)}:${pad(minutes % 60)}`);
}

/** 90 → "1시간 30분", 60 → "1시간", 30 → "30분" */
export function durationLabel(mins: number): string {
  if (mins < 60) return `${mins}분`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

/** "2026-08-01" → "8월 1일 (토)" */
export function dateWithWeekday(dateKey: string): string {
  const [, mo, dy] = dateKey.split("-").map(Number);
  return `${mo}월 ${dy}일 (${weekdayKo(dateKey)})`;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function weekdayKo(dateKey: string): string {
  return WEEKDAYS[new Date(`${dateKey}T00:00:00Z`).getUTCDay()];
}

/** 토요일은 파랑, 일요일은 빨강. 원본 목업의 요일 색 규칙. */
export function weekdayColor(dateKey: string): string {
  const w = weekdayKo(dateKey);
  if (w === "토") return "var(--wds-accent-blue)";
  if (w === "일") return "var(--wds-accent-red)";
  return "var(--wds-label-normal)";
}

/** "8/1" — 격자 열 머리에 쓰는 짧은 날짜. */
export function shortDate(dateKey: string): string {
  const [, mo, dy] = dateKey.split("-").map(Number);
  return `${mo}/${dy}`;
}

const WEEK_LABELS = ["첫째", "둘째", "셋째", "넷째", "다섯째"] as const;

/**
 * 날짜 범위로 제목을 지어 준다. 입력칸 placeholder와 Tab 자동완성에 쓰는 제안값이다.
 * 한 달 안에 든 한 주는 사람이 부르는 대로 "8월 첫째 주", 그 밖은 날짜 범위로.
 */
export function suggestPollTitle(startsOn: string, endsOn: string): string {
  const start = startsOn.split("-").map(Number);
  const end = endsOn.split("-").map(Number);
  if (start.length !== 3 || end.length !== 3 || start.some(Number.isNaN)) return "";
  if (end.some(Number.isNaN) || endsOn < startsOn) return "";

  const [, startMonth, startDay] = start;
  const [, endMonth, endDay] = end;
  const week = WEEK_LABELS[Math.ceil(startDay / 7) - 1];

  if (startMonth === endMonth && diffDays(startsOn, endsOn) <= 6 && week) {
    return `${startMonth}월 ${week} 주 모지숲 회의`;
  }
  if (startMonth === endMonth) {
    return `${startMonth}/${startDay}~${endDay} 모지숲 회의`;
  }
  return `${startMonth}/${startDay}~${endMonth}/${endDay} 모지숲 회의`;
}

/** 확정 시각 + 소요시간 → 종료 시각 ISO. 달력 칩의 시간 표기용. */
export function slotEndIso(startIso: string, durationMin: number): string {
  return new Date(new Date(startIso).getTime() + durationMin * 60_000).toISOString();
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}
