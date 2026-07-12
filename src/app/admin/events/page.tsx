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
  session: "정기세션",
  study: "스터디",
  mogakco: "모각코",
  party: "파티",
};

const TYPE_TONES: Record<EventType, "primary" | "success" | "warning" | "danger"> = {
  session: "primary",
  study: "success",
  mogakco: "warning",
  party: "danger",
};

const TYPE_BAR: Record<EventType, string> = {
  session: "bg-primary",
  study: "bg-success",
  mogakco: "bg-warning",
  party: "bg-danger",
};

const TYPE_TEXT: Record<EventType, string> = {
  session: "text-primary",
  study: "text-success",
  mogakco: "text-warning",
  party: "text-danger",
};

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {list.map((event) => {
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
              <Link key={event.id} href={`/admin/events/${event.id}`}>
                <Card className="h-full transition-[transform,box-shadow] duration-150 hover:shadow-md active:scale-[0.98]">
                  <div className="flex items-start justify-between gap-2">
                    <Badge tone={TYPE_TONES[event.type]}>
                      {TYPE_LABELS[event.type]}
                    </Badge>
                    <span
                      className={
                        closingSoon
                          ? `text-sm font-semibold ${TYPE_TEXT[event.type]}`
                          : "text-sm text-gray-400"
                      }
                    >
                      {capacity
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
      )}
    </div>
  );
}
