import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { DEMO_EVENTS, DEMO_EVENT_CONFIRMED_COUNTS } from "@/lib/demoData";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { MonthFilter } from "@/components/MonthFilter";
import { EventCards } from "@/components/EventCards";
import { formatMonthLabel, monthKst } from "@/lib/format";
import type { Event } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
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

  const months = Array.from(new Set(all.map((e) => monthKst(e.starts_at))));
  const list = month ? all.filter((e) => monthKst(e.starts_at) === month) : all;

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
      <PageHeader
        title="이벤트"
        description="정기세션·스터디·모각코를 관리해요"
        action={
          <div className="flex items-center gap-2">
            <MonthFilter
              options={monthOptions}
              value={month ?? ""}
              basePath="/admin/events"
            />
            <Link href="/admin/events/new">
              <Button type="button" variant="primary">
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
                이벤트 생성
              </Button>
            </Link>
          </div>
        }
      />
      {list.length === 0 ? (
        <EmptyState
          title="등록된 이벤트가 없어요"
          description="첫 정기세션·스터디·모각코를 만들어 신청을 받아보세요."
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
