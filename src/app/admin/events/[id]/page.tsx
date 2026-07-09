import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { DEMO_EVENTS } from "@/lib/demoData";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { AttendancePanel } from "@/components/AttendancePanel";
import type { Event } from "@/lib/types";
import { EventForm } from "../EventForm";
import { DeleteEventButton } from "../DeleteEventButton";

export const dynamic = "force-dynamic";

export default async function AdminEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const demo = await isDemoMode();

  let e: Event | undefined;

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
  }

  if (!e) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="이벤트 수정" action={<DeleteEventButton eventId={e.id} />} />
      <Card>
        <EventForm event={e} />
      </Card>
      <AttendancePanel eventId={e.id} />
    </div>
  );
}
