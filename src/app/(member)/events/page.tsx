import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { DEMO_EVENTS, DEMO_EVENT_CONFIRMED_COUNTS } from "@/lib/demoData";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { EventCards } from "@/components/EventCards";
import { EventStatusToggle } from "@/components/EventStatusToggle";
import { MonthFilter } from "@/components/MonthFilter";
import { isEventPast } from "@/lib/event-status";
import { formatMonthLabel, monthKst } from "@/lib/format";
import type { Event } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MemberEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; status?: string }>;
}) {
  const { month, status } = await searchParams;
  const demo = await isDemoMode();

  let all: Event[] = DEMO_EVENTS;
  const counts: Record<string, number> = demo ? { ...DEMO_EVENT_CONFIRMED_COUNTS } : {};

  if (!demo) {
    const supabase = await createClient();
    const { data: events } = await supabase
      .from("events")
      .select("*")
      .order("starts_at", { ascending: false });
    all = (events ?? []) as Event[];
  }

  const months = Array.from(new Set(all.map((event) => monthKst(event.starts_at))));
  const isPastView = status === "past";
  const list = (month ? all.filter((event) => monthKst(event.starts_at) === month) : all).filter((event) =>
    isPastView ? isEventPast(event) : !isEventPast(event),
  );
  const monthOptions = [
    { value: "", label: "전체" },
    ...months.map((value) => ({ value, label: formatMonthLabel(value) })),
  ];

  if (!demo && list.length > 0) {
    const supabase = await createClient();
    const { data: countRows } = await supabase.rpc("event_confirmed_counts", {
      p_event_ids: list.map((event) => event.id),
    });
    for (const row of countRows ?? []) {
      counts[row.event_id] = Number(row.confirmed);
    }
  }

  return (
    <div>
      <PageHeader
        title="이벤트"
        description="정기세션·스터디·모각코를 확인해요"
        action={
          <div className="flex items-center gap-2">
            <EventStatusToggle basePath="/events" past={isPastView} month={month} />
            <MonthFilter options={monthOptions} value={month ?? ""} basePath="/events" query={isPastView ? { status: "past" } : undefined} />
          </div>
        }
      />
      {list.length === 0 ? (
        <EmptyState
          title={isPastView ? "지난 일정이 없어요" : "예정된 이벤트가 없어요"}
          description={isPastView ? "종료된 이벤트가 여기에서 보여요." : "새 이벤트가 등록되면 여기에서 확인할 수 있어요."}
        />
      ) : (
        <EventCards events={list} counts={counts} hrefBase="/events" />
      )}
    </div>
  );
}
