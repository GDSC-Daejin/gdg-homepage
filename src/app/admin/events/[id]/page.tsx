import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
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

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (!event) notFound();
  const e = event as Event;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="이벤트 수정" action={<DeleteEventButton eventId={e.id} />} />
      <Card>
        <EventForm event={e} />
      </Card>
      <div>{/* Task8: AttendancePanel */}</div>
    </div>
  );
}
