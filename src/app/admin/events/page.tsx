import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { formatKst } from "@/lib/format";
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

export default async function AdminEventsPage() {
  const supabase = await createClient();

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

  return (
    <div>
      <PageHeader
        title="이벤트"
        description="세션·스터디·데브페스트를 관리해요"
        action={
          <Link href="/admin/events/new">
            <Button type="button" variant="primary">
              이벤트 생성
            </Button>
          </Link>
        }
      />
      {list.length === 0 ? (
        <EmptyState title="등록된 이벤트가 없어요" />
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((event) => (
            <Link key={event.id} href={`/admin/events/${event.id}`}>
              <Card className="transition-shadow hover:shadow-md">
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
                  <p className="shrink-0 text-sm text-gray-500">
                    {counts[event.id] ?? 0}
                    {event.capacity ? ` / ${event.capacity}` : ""}명 신청
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
