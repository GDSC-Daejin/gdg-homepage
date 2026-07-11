export function formatKst(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatKstDate(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
  }).format(new Date(iso));
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
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** 시작~종료 일시. 종료 없으면 시작만, 같은 날이면 종료는 시각만 표시. */
export function formatKstRange(start: string, end: string | null): string {
  if (!end) return formatKst(start);
  if (kstDay(start) === kstDay(end)) {
    return `${formatKst(start)} ~ ${formatKstTime(end)}`;
  }
  return `${formatKst(start)} ~ ${formatKst(end)}`;
}
