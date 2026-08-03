import { dayKeyKst, timeKeyKst } from "@/lib/format";
import { EVENT_TYPE_BG, EVENT_TYPE_OPTIONS } from "@/lib/event-type";
import type { Event, EventType } from "@/lib/types";

export interface CalendarInterview {
  id: string;
  starts_at: string;
  status: string;
}

export interface CalendarMeeting {
  id: string;
  title: string;
  starts_at: string;
  duration_min: number;
}

export type CalendarFilter = EventType | "interview" | "meeting" | null;

export interface CalendarLegendItem {
  key: CalendarFilter;
  label: string;
  dot: string;
  count: number;
  dashed: boolean;
}

export interface UpcomingCalendarItem {
  key: string;
  dateKey: string;
  sortKey: string;
  dot: string;
  title: string;
  muted: boolean;
  meta: string;
  href: string;
}

function groupByDay<T extends { starts_at: string }>(items: T[]) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = dayKeyKst(item.starts_at);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }
  return map;
}

export function buildCalendarProjection({
  events,
  interviews,
  meetings,
  month,
  today,
}: {
  events: Event[];
  interviews: CalendarInterview[];
  meetings: CalendarMeeting[];
  month: string;
  today: string;
}) {
  const eventsByDay = groupByDay(events);
  const interviewsByDay = groupByDay(interviews);
  const meetingsByDay = groupByDay(meetings);
  const monthEvents = events.filter((event) => dayKeyKst(event.starts_at).startsWith(month));
  const monthInterviews = interviews.filter((slot) => dayKeyKst(slot.starts_at).startsWith(month));
  const monthMeetings = meetings.filter((meeting) => dayKeyKst(meeting.starts_at).startsWith(month));
  const countByType = new Map<EventType, number>();
  for (const event of monthEvents) {
    countByType.set(event.type, (countByType.get(event.type) ?? 0) + 1);
  }

  const legend: CalendarLegendItem[] = [
    ...EVENT_TYPE_OPTIONS.filter((option) => countByType.has(option.value)).map((option) => ({
      key: option.value,
      label: option.label,
      dot: EVENT_TYPE_BG[option.value],
      count: countByType.get(option.value) ?? 0,
      dashed: false,
    })),
    ...(monthInterviews.length > 0
      ? [{ key: "interview" as const, label: "면접", dot: "bg-gray-400", count: monthInterviews.length, dashed: true }]
      : []),
    ...(monthMeetings.length > 0
      ? [{ key: "meeting" as const, label: "회의", dot: "bg-primary/60", count: monthMeetings.length, dashed: true }]
      : []),
  ];

  const upcoming: UpcomingCalendarItem[] = [
    ...events
      .filter((event) => dayKeyKst(event.starts_at) >= today)
      .map((event) => ({
        key: event.id,
        dateKey: dayKeyKst(event.starts_at),
        sortKey: event.starts_at,
        dot: EVENT_TYPE_BG[event.type],
        title: event.title,
        muted: false,
        meta: [timeKeyKst(event.starts_at), event.location].filter(Boolean).join(" · "),
        href: `/admin/events/${event.id}`,
      })),
    ...[...interviewsByDay.entries()]
      .filter(([dateKey]) => dateKey >= today)
      .map(([dateKey, slots]) => {
        const booked = slots.filter((slot) => slot.status === "booked").length;
        return {
          key: `interview-${dateKey}`,
          dateKey,
          sortKey: slots[0].starts_at,
          dot: "bg-gray-400",
          title: `면접${booked > 0 ? " · 예약" : ""} ${slots.length}건`,
          muted: true,
          meta: `${timeKeyKst(slots[0].starts_at)} · 표시 전용`,
          href: "/admin/interviews",
        };
      }),
    ...meetings
      .filter((meeting) => dayKeyKst(meeting.starts_at) >= today)
      .map((meeting) => ({
        key: `meeting-${meeting.id}`,
        dateKey: dayKeyKst(meeting.starts_at),
        sortKey: meeting.starts_at,
        dot: "bg-primary/60",
        title: meeting.title,
        muted: true,
        meta: `${timeKeyKst(meeting.starts_at)} · 회의 ${meeting.duration_min}분`,
        href: `/schedule/${meeting.id}`,
      })),
  ]
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .slice(0, 5);

  return {
    eventsByDay,
    interviewsByDay,
    meetingsByDay,
    legend,
    totalCount: monthEvents.length + monthInterviews.length + monthMeetings.length,
    upcoming,
  };
}
