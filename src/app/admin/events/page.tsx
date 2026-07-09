import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { DEMO_EVENTS, DEMO_EVENT_CONFIRMED_COUNTS } from "@/lib/demoData";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { MonthFilter } from "@/components/MonthFilter";
import { formatKst, formatMonthLabel, monthKst } from "@/lib/format";
import type { Event, EventType } from "@/lib/types";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<EventType, string> = {
  session: "세션",
  study: "스터디",
  devfest: "데브페스트",
};

const TYPE_TONES: Record<EventType, "primary" | "success" | "warning"> = {
  session: "primary",
  study: "success",
  devfest: "warning",
};

const TYPE_BORDER_VAR: Record<EventType, string> = {
  session: "var(--color-primary)",
  study: "var(--color-success)",
  devfest: "var(--color-warning)",
};

const TYPE_BAR: Record<EventType, string> = {
  session: "bg-primary",
  study: "bg-success",
  devfest: "bg-warning",
};

const TYPE_TEXT: Record<EventType, string> = {
  session: "text-primary",
  study: "text-success",
  devfest: "text-warning",
};

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
        description="세션·스터디·데브페스트를 관리해요"
        action={
          <div className="flex items-center gap-2">
            <MonthFilter
              options={monthOptions}
              value={month ?? ""}
              basePath="/admin/events"
            />
            <Link href="/admin/events/new">
              <Button type="button" variant="primary">
                이벤트 생성
              </Button>
            </Link>
          </div>
        }
      />
      {list.length === 0 ? (
        <EmptyState
          title="등록된 이벤트가 없어요"
          description="첫 세션·스터디·데브페스트를 만들어 신청을 받아보세요."
          action={
            <Link href="/admin/events/new">
              <Button type="button" variant="primary">
                이벤트 생성
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((event) => {
            const confirmed = counts[event.id] ?? 0;
            const capacity = event.capacity;
            const remaining = capacity ? capacity - confirmed : null;
            const closingSoon =
              capacity !== null &&
              remaining !== null &&
              remaining >= 0 &&
              remaining / capacity <= 0.1;

            return (
              <Link key={event.id} href={`/admin/events/${event.id}`}>
                <Card
                  className="transition-shadow hover:shadow-md"
                  style={{ borderLeftWidth: 4, borderLeftColor: TYPE_BORDER_VAR[event.type] }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge tone={TYPE_TONES[event.type]}>
                          {TYPE_LABELS[event.type]}
                        </Badge>
                        <h2 className="text-base font-semibold text-gray-900">
                          {event.title}
                        </h2>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        {formatKst(event.starts_at)}
                        {event.location ? ` · ${event.location}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="flex flex-col items-end gap-1">
                        <p className="text-sm text-gray-500">
                          <span className="text-xl font-bold text-gray-900">
                            {confirmed}
                          </span>
                          {capacity ? ` / ${capacity}` : ""} 명 신청
                        </p>
                        {capacity ? (
                          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className={`h-full rounded-full ${TYPE_BAR[event.type]}`}
                              style={{
                                width: `${Math.min(100, (confirmed / capacity) * 100)}%`,
                              }}
                            />
                          </div>
                        ) : null}
                        <p
                          className={
                            closingSoon
                              ? `text-xs font-medium ${TYPE_TEXT[event.type]}`
                              : "text-xs text-gray-400"
                          }
                        >
                          {capacity
                            ? closingSoon
                              ? `마감임박 · 잔여 ${remaining}석`
                              : `잔여 ${remaining}석`
                            : "정원 무제한"}
                        </p>
                      </div>
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.75}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 shrink-0 text-gray-300"
                      >
                        <path d="M7 4l6 6-6 6" />
                      </svg>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
