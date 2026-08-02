// 달력 그리드·날짜 이동 헬퍼. 한국은 서머타임이 없어 KST를 고정 +09:00으로 다룬다.
const KST = "+09:00";

/**
 * "YYYY-MM" → 일요일 시작 6주(42칸)의 "YYYY-MM-DD" 배열.
 * 앞뒤 달 날짜로 채워 어떤 달이든 격자 높이가 같다.
 * 시간대가 끼어들지 않도록 UTC 자정 기준으로만 계산한다.
 */
export function monthGrid(month: string): string[] {
  const [year, mon] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, mon - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    return day.toISOString().slice(0, 10);
  });
}

/** "YYYY-MM"에서 delta개월 이동. */
export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** "YYYY-MM-DD" 다음 날. */
export function nextDayKey(dateKey: string): string {
  const day = new Date(`${dateKey}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" KST 자정의 ISO. 범위 조회 경계용. */
export function kstDayStartIso(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00${KST}`).toISOString();
}

/** KST 시각(시:분:초)은 그대로 두고 날짜만 dateKey로 바꾼 ISO. 드래그 이동용. */
export function shiftToDateKst(iso: string, dateKey: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const time = `${get("hour")}:${get("minute")}:${get("second")}`;
  return new Date(`${dateKey}T${time}${KST}`).toISOString();
}

export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** "YYYY-MM-DD"의 요일 라벨. 격자와 같은 UTC 자정 기준이라 시간대가 끼어들지 않는다. */
export function weekdayLabel(dateKey: string): string {
  return WEEKDAY_LABELS[new Date(`${dateKey}T00:00:00Z`).getUTCDay()];
}

/** to - from 일수. D-day 배지용. */
export function diffDays(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
}
