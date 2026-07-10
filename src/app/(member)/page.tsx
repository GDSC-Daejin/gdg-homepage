import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { MonthFilter } from "@/components/MonthFilter";
import { formatKst, formatMonthLabel, monthKst } from "@/lib/format";
import type { Event, EventType, Notice } from "@/lib/types";

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

function EventCard({ event, confirmed }: { event: Event; confirmed: number }) {
  return (
    <Link href={`/events/${event.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <div className="flex items-center gap-2">
          <Badge tone={TYPE_TONES[event.type]}>{TYPE_LABELS[event.type]}</Badge>
          <h2 className="text-base font-semibold text-gray-900">
            {event.title}
          </h2>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          {formatKst(event.starts_at)}
        </p>
        {event.location && (
          <p className="text-sm text-gray-500">{event.location}</p>
        )}
        <p className="mt-2 text-xs text-gray-400">
          {confirmed}
          {event.capacity ? ` / ${event.capacity}` : ""}명 신청
        </p>
      </Card>
    </Link>
  );
}

export default async function MemberHomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireProfile();
  const { month } = await searchParams;
  const supabase = await createClient();

  const { data: latestNotice } = await supabase
    .from("notices")
    .select("id, title")
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("starts_at", { ascending: false });

  const list = (events ?? []) as Event[];

  const counts: Record<string, number> = {};
  if (list.length > 0) {
    const { data: countRows } = await supabase.rpc("event_confirmed_counts", {
      p_event_ids: list.map((e) => e.id),
    });
    for (const row of countRows ?? []) {
      counts[row.event_id] = Number(row.confirmed);
    }
  }

  const now = Date.now();
  const upcoming = list
    .filter((e) => new Date(e.starts_at).getTime() >= now)
    .reverse();
  const allPast = list.filter((e) => new Date(e.starts_at).getTime() < now);

  const pastMonths = Array.from(new Set(allPast.map((e) => monthKst(e.starts_at))));
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const past =
    month === "all"
      ? allPast
      : month
        ? allPast.filter((e) => monthKst(e.starts_at) === month)
        : allPast.filter((e) => new Date(e.starts_at) >= threeMonthsAgo);

  const monthOptions = [
    { value: "", label: "최근 3개월" },
    { value: "all", label: "전체" },
    ...pastMonths.map((m) => ({ value: m, label: formatMonthLabel(m) })),
  ];

  const notice = latestNotice as Pick<Notice, "id" | "title"> | null;

  return (
    <div className="flex flex-col gap-8">
      {notice && (
        <Link href={`/notices/${notice.id}`}>
          <Card className="flex items-center gap-2 bg-primary-soft transition-shadow hover:shadow-md">
            <Badge tone="primary">공지</Badge>
            <p className="text-sm font-medium text-gray-900">{notice.title}</p>
          </Card>
        </Link>
      )}
      <div>
        <PageHeader title="다가오는 이벤트" />
        {upcoming.length === 0 ? (
          <EmptyState title="예정된 이벤트가 없어요" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {upcoming.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                confirmed={counts[event.id] ?? 0}
              />
            ))}
          </div>
        )}
      </div>
      <div>
        <PageHeader
          title="지난 이벤트"
          action={
            <MonthFilter
              options={monthOptions}
              value={month ?? ""}
              basePath="/"
            />
          }
        />
        {past.length === 0 ? (
          <EmptyState title="지난 이벤트가 없어요" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {past.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                confirmed={counts[event.id] ?? 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
