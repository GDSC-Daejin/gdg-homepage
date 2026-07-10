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
