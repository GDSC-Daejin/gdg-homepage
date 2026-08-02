import { formatKst } from "@/lib/format";
import type { Event, EventType } from "@/lib/types";

const TYPE_LABELS: Record<EventType, string> = {
  session: "정기세션",
  study: "스터디",
  mogakco: "모각코",
  party: "파티",
};

export function buildEventReminderMessage(
  events: Event[],
  counts: Record<string, number>,
): string | null {
  if (events.length === 0) return null;

  const lines = events.map((event) => {
    const confirmed = counts[event.id] ?? 0;
    const applied = event.capacity
      ? `신청 ${confirmed}/${event.capacity}명`
      : `신청 ${confirmed}명`;
    const parts = [
      `[${TYPE_LABELS[event.type]}] ${event.title}`,
      formatKst(event.starts_at),
      event.location,
      applied,
    ].filter(Boolean);
    return `- ${parts.join(" · ")}`;
  });

  return `[이벤트 리마인더] 내일 시작하는 이벤트 ${events.length}건\n${lines.join("\n")}`;
}
