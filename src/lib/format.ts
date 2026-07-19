// ICU(CLDR) 버전에 따라 ko-KR dayPeriod가 "오후" 대신 "PM"으로 나오는 경우가 있어
// 시각은 24시간제 값을 직접 얻어 "오전/오후"를 조립한다.
function kstTimeOfDay(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((p) => p.type === "hour")?.value) % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  const period = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${period} ${hour12}:${minute.toString().padStart(2, "0")}`;
}

export function formatKst(iso: string): string {
  return `${formatKstDate(iso)} ${kstTimeOfDay(iso)}`;
}

export function formatKstDate(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
  }).format(new Date(iso));
}

/** "방금 전 / N분 전 / N시간 전 / (그 이상) YYYY. M. D." — 알림 상대시간용 */
export function formatRelativeKst(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return formatKstDate(iso);
}

/** KST 기준 "YYYY-MM" */
export function monthKst(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(iso));
}

/** "YYYY-MM" → "YYYY년 M월" */
export function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}년 ${Number(m)}월`;
}

function kstDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function formatKstTime(iso: string): string {
  return kstTimeOfDay(iso);
}

/** 시작~종료 일시. 종료 없으면 시작만, 같은 날이면 종료는 시각만 표시. */
export function formatKstRange(start: string, end: string | null): string {
  if (!end) return formatKst(start);
  if (kstDay(start) === kstDay(end)) {
    return `${formatKst(start)} ~ ${formatKstTime(end)}`;
  }
  return `${formatKst(start)} ~ ${formatKst(end)}`;
}
