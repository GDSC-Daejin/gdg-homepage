import { DURATION_OPTIONS, slotIso } from "@/lib/meeting-poll";

export function pastDue(dueAt: string | null): boolean {
  return Boolean(dueAt && Date.now() > Date.parse(dueAt));
}

export function nearestDuration(mins: number): number {
  return (
    DURATION_OPTIONS.find((duration) => duration >= mins) ??
    DURATION_OPTIONS[DURATION_OPTIONS.length - 1]
  );
}

/** "HH:mm"에 분을 더한 "HH:mm". 자정을 넘으면 24:00으로 맞춘다. */
export function addMinutes(time: string, add: number): string {
  const [hour, minute] = time.split(":").map(Number);
  const total = Math.min(24 * 60, hour * 60 + minute + add);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function kstDayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function kstTime(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function endOf(
  recommendation: { to: number; dateIndex: number },
  times: string[],
  dates: string[],
): string {
  return slotIso(dates[recommendation.dateIndex], times[recommendation.to]);
}
