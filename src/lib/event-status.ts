import type { Event } from "@/lib/types";

export function isEventPast(event: Pick<Event, "starts_at" | "ends_at">, now = new Date()) {
  return new Date(event.ends_at ?? event.starts_at) < now;
}
