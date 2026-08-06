import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { DEMO_EVENTS, DEMO_EVENT_CONFIRMED_COUNTS } from "@/lib/demoData";
import { PageHeader } from "@/components/PageHeader";
import { SectionTabs, EVENT_TABS } from "../SectionTabs";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { EventStatusToggle } from "@/components/EventStatusToggle";
import { MonthFilter } from "@/components/MonthFilter";
import { EventCards } from "@/components/EventCards";
import { cn } from "@/lib/cn";
import { kstDayStartIso, monthGrid, nextDayKey } from "@/lib/calendar";
import { isEventPast } from "@/lib/event-status";
import { dayKeyKst, formatMonthLabel, monthKst } from "@/lib/format";
import type { Event, Place } from "@/lib/types";
import {
  EventCalendar,
  type CalendarInterview,
  type CalendarMeeting,
} from "./EventCalendar";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; view?: string; status?: string }>;
}) {
  const { month, view, status } = await searchParams;
  const demo = await isDemoMode();
  const isCalendar = view === "calendar";
  const today = dayKeyKst(new Date().toISOString());

  if (isCalendar) {
    // 격자에는 앞뒤 달 날짜도 보이므로 42칸 전체를 덮는 범위로 조회한다.
    const gridMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : today.slice(0, 7);
    const grid = monthGrid(gridMonth);
    const from = kstDayStartIso(grid[0]);
    const to = kstDayStartIso(nextDayKey(grid[grid.length - 1]));

    let events: Event[] = DEMO_EVENTS.filter(
      (e) => e.starts_at >= from && e.starts_at < to,
    );
    let interviews: CalendarInterview[] = [];
    let meetings: CalendarMeeting[] = [];
    let places: Place[] = [];

    if (!demo) {
      const supabase = await createClient();
      const [eventRes, interviewRes, meetingRes, placeRes] = await Promise.all([
        supabase
          .from("events")
          .select("*")
          .gte("starts_at", from)
          .lt("starts_at", to)
          .order("starts_at"),
        supabase
          .from("interview_slots")
          .select("id, starts_at, status")
          .gte("starts_at", from)
          .lt("starts_at", to)
          .in("status", ["open", "booked"])
          .order("starts_at"),
        supabase
          .from("meeting_polls")
          .select("id, title, confirmed_at, duration_min")
          .gte("confirmed_at", from)
          .lt("confirmed_at", to)
          .order("confirmed_at"),
        supabase.from("places").select("*").order("name"),
      ]);
      events = (eventRes.data ?? []) as Event[];
      interviews = (interviewRes.data ?? []) as CalendarInterview[];
      // 달력은 starts_at 하나로만 날짜를 묶는다 — 확정 시각을 그 이름으로 맞춰 넘긴다.
      meetings = (
        (meetingRes.data ?? []) as {
          id: string;
          title: string;
          confirmed_at: string;
          duration_min: number;
        }[]
      ).map((poll) => ({
        id: poll.id,
        title: poll.title,
        starts_at: poll.confirmed_at,
        duration_min: poll.duration_min,
      }));
      places = (placeRes.data ?? []) as Place[];
    }

    return (
      <div>
        <SectionTabs tabs={EVENT_TABS} label="이벤트" />
        <PageHeader
          title="이벤트"
          description="정기세션·스터디·모각코를 관리해요"
          action={
            <div className="flex items-center gap-2">
              <ViewToggle isCalendar month={gridMonth} />
              <Link href="/admin/events/new">
                <Button type="button" variant="primary">
                  <PlusIcon />
                  이벤트 생성
                </Button>
              </Link>
            </div>
          }
        />
        <EventCalendar
          month={gridMonth}
          events={events}
          interviews={interviews}
          meetings={meetings}
          places={places}
          today={today}
          readOnly={demo}
        />
      </div>
    );
  }

  let all: Event[] = DEMO_EVENTS;
  const counts: Record<string, number> = demo ? { ...DEMO_EVENT_CONFIRMED_COUNTS } : {};

  if (!demo) {
    const supabase = await createClient();
    const { data: events } = await supabase
      .from("events")
      .select("*")
      .order("event_date", { ascending: false, nullsFirst: false });
    all = (events ?? []) as Event[];
  }

  const eventMonth = (event: Event) => event.event_date?.slice(0, 7) ?? (event.starts_at ? monthKst(event.starts_at) : "");
  const months = Array.from(new Set(all.map(eventMonth).filter(Boolean)));
  const isPastView = status === "past";
  const list = (month ? all.filter((e) => eventMonth(e) === month) : all).filter((e) =>
    isPastView ? isEventPast(e) : !isEventPast(e),
  );

  const monthOptions = [
    { value: "", label: "전체" },
    ...months.map((m) => ({ value: m, label: formatMonthLabel(m) })),
  ];

  if (!demo && list.length > 0) {
    const supabase = await createClient();
    const { data: countRows } = await supabase.rpc("event_confirmed_counts", {
      p_event_ids: list.map((e) => e.id),
    });
    for (const row of countRows ?? []) {
      counts[row.event_id] = Number(row.confirmed);
    }
  }

  return (
    <div>
      <SectionTabs tabs={EVENT_TABS} label="이벤트" />
      <PageHeader
        title="이벤트"
        description="정기세션·스터디·모각코를 관리해요"
        action={
          <div className="flex items-center gap-2">
            <ViewToggle isCalendar={false} month={month || today.slice(0, 7)} />
            <EventStatusToggle basePath="/admin/events" past={isPastView} month={month} />
            <MonthFilter
              options={monthOptions}
              value={month ?? ""}
              basePath="/admin/events"
              query={isPastView ? { status: "past" } : undefined}
            />
            <Link href="/admin/events/new">
              <Button type="button" variant="primary">
                <PlusIcon />
                이벤트 생성
              </Button>
            </Link>
          </div>
        }
      />
      {list.length === 0 ? (
        <EmptyState
          title={isPastView ? "지난 일정이 없어요" : "예정된 이벤트가 없어요"}
          description={isPastView ? "종료된 이벤트가 여기에서 보여요." : "첫 정기세션·스터디·모각코를 만들어 신청을 받아보세요."}
          action={
            <Link href="/admin/events/new">
              <Button type="button" variant="primary">
                이벤트 생성
              </Button>
            </Link>
          }
        />
      ) : (
        <EventCards events={list} counts={counts} hrefBase="/admin/events" />
      )}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className="mr-1.5 h-4 w-4"
    >
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

function ViewToggle({ isCalendar, month }: { isCalendar: boolean; month: string }) {
  const base =
    "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors duration-100";
  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-gray-300 p-0.5"
      role="group"
      aria-label="보기 전환"
    >
      <Link
        href="/admin/events"
        aria-current={isCalendar ? undefined : "page"}
        className={cn(base, isCalendar ? "text-gray-600 hover:bg-gray-100" : "bg-primary-soft text-primary")}
      >
        목록
      </Link>
      <Link
        href={`/admin/events?view=calendar&month=${month}`}
        aria-current={isCalendar ? "page" : undefined}
        className={cn(base, isCalendar ? "bg-primary-soft text-primary" : "text-gray-600 hover:bg-gray-100")}
      >
        달력
      </Link>
    </div>
  );
}
