import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { DEMO_EVENTS } from "@/lib/demoData";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { AttendanceStatusCard } from "@/components/AttendanceStatusCard";
import { RegistrantsTable } from "@/components/RegistrantsTable";
import { formatKst } from "@/lib/format";
import type { Event, EventType, Place } from "@/lib/types";
import { EventForm } from "../EventForm";
import { DeleteEventButton } from "../DeleteEventButton";

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

export default async function AdminEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const demo = await isDemoMode();

  let e: Event | undefined;
  let places: Place[] = [];

  if (demo) {
    e = DEMO_EVENTS.find((ev) => ev.id === id) ?? DEMO_EVENTS[0];
  } else {
    const supabase = await createClient();
    const { data: event } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();

    if (!event) notFound();
    e = event as Event;

    const { data: placeRows } = await supabase
      .from("places")
      .select("*")
      .order("name", { ascending: true });
    places = (placeRows ?? []) as Place[];
  }

  if (!e) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone={TYPE_TONES[e.type]}>{TYPE_LABELS[e.type]}</Badge>
            <h1 className="text-xl font-bold text-gray-900">이벤트 수정</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {e.title} · {formatKst(e.starts_at)}
          </p>
        </div>
        <DeleteEventButton eventId={e.id} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 text-gray-500"
            >
              <path d="M13.5 3.5a1.5 1.5 0 0 1 2 2L6 15l-3 1 1-3Z" />
            </svg>
            <p className="text-sm font-semibold text-gray-900">이벤트 정보 수정</p>
          </div>
          <EventForm event={e} places={places} />
        </Card>
        <AttendanceStatusCard eventId={e.id} />
      </div>

      <RegistrantsTable eventId={e.id} />
    </div>
  );
}
