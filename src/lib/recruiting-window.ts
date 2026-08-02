/** 오늘(KST) "YYYY-MM-DD" */
export function kstToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export type RecruitingStatus = "closed" | "scheduled" | "open" | "expired";

/** 수동 스위치(isOpen) + 지원기간(start~end)으로 4단계 상태 판정. 종료일이 지나면 자동 마감. */
export function recruitingStatus(isOpen: boolean, start: string, end: string): RecruitingStatus {
  if (!isOpen) return "closed";
  const today = kstToday();
  if (start && today < start) return "scheduled";
  if (end && today > end) return "expired";
  return "open";
}
