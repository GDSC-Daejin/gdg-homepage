import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { formatKst } from "@/lib/format";
import {
  EVENT_TYPE_BG as TYPE_BAR,
  EVENT_TYPE_LABELS as TYPE_LABELS,
  EVENT_TYPE_TEXT as TYPE_TEXT,
  EVENT_TYPE_TONES as TYPE_TONES,
} from "@/lib/event-type";
import { isEventPast } from "@/lib/event-status";
import type { Event } from "@/lib/types";

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className="h-3.5 w-3.5 shrink-0 text-gray-400"
    >
      <rect x="3" y="4" width="14" height="13" rx="2" />
      <path d="M3 8h14M7 2v3M13 2v3" strokeLinecap="round" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className="h-3.5 w-3.5 shrink-0 text-gray-400"
    >
      <path d="M10 18s6-5.7 6-10.2a6 6 0 1 0-12 0C4 12.3 10 18 10 18Z" />
      <circle cx="10" cy="7.8" r="2" />
    </svg>
  );
}

export function EventCards({
  events,
  counts,
  hrefBase,
}: {
  events: Event[];
  counts: Record<string, number>;
  hrefBase: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {events.map((event) => {
        const past = isEventPast(event);
        const confirmed = counts[event.id] ?? 0;
        const capacity = event.capacity;
        const remaining = capacity ? capacity - confirmed : null;
        const closingSoon =
          capacity !== null &&
          remaining !== null &&
          remaining >= 0 &&
          remaining / capacity <= 0.1;
        const barWidth = capacity
          ? Math.min(100, (confirmed / capacity) * 100)
          : 100;

        return (
          <Link key={event.id} href={`${hrefBase}/${event.id}`}>
            <Card className="h-full transition-[transform,box-shadow] duration-150 hover:shadow-md active:scale-[0.98]">
              <div className="flex items-start justify-between gap-2">
                <Badge tone={TYPE_TONES[event.type]}>
                  {TYPE_LABELS[event.type]}
                </Badge>
                <span
                  className={
                    past
                      ? "text-sm font-semibold text-gray-400"
                      : closingSoon
                      ? `text-sm font-semibold ${TYPE_TEXT[event.type]}`
                      : "text-sm text-gray-400"
                  }
                >
                  {past
                    ? "종료됨"
                    : capacity
                    ? closingSoon
                      ? `마감임박 · 잔여 ${remaining}석`
                      : `잔여 ${remaining}석`
                    : "정원 무제한"}
                </span>
              </div>

              <h2 className="mt-3 text-lg font-semibold text-gray-900">
                {event.title}
              </h2>

              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <CalendarIcon />
                  {formatKst(event.starts_at)}
                </span>
                {event.location ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="text-gray-300">·</span>
                    <LocationIcon />
                    {event.location}
                  </span>
                ) : null}
              </p>

              <p className="mt-4 text-sm text-gray-500">
                <span className="text-xl font-bold text-gray-900">
                  {confirmed}
                </span>
                {capacity ? ` / ${capacity}` : ""} 명 신청
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${TYPE_BAR[event.type]}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
