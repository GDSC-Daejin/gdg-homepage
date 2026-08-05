import { formatKstRange } from "@/lib/format";
import type { Event } from "@/lib/types";

export function formatEventSchedule(event: Pick<Event, "starts_at" | "ends_at" | "event_date" | "start_time" | "end_time">) {
  if (!event.event_date) return "날짜는 추후 확정돼요!";
  if (!event.start_time) return `${event.event_date.replaceAll("-", ". ")} · 시작 시간 미정`;
  return formatKstRange(event.starts_at, event.ends_at);
}
