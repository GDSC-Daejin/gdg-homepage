import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { RegistrationPanel } from "@/components/RegistrationPanel";
import { formatKstRange } from "@/lib/format";
import { EventLocation } from "@/components/EventLocation";
import type { Event, EventType } from "@/lib/types";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<EventType, string> = {
  session: "정기세션",
  study: "스터디",
  mogakco: "모각코",
};

const TYPE_TONES: Record<EventType, "primary" | "success" | "warning"> = {
  session: "primary",
  study: "success",
  mogakco: "warning",
};

export default async function MemberEventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const { code } = await searchParams;

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (!event) notFound();
  const e = event as Event;

  const { data: countRows } = await supabase.rpc("event_confirmed_counts", {
    p_event_ids: [e.id],
  });
  const confirmed = Number(countRows?.[0]?.confirmed ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={e.title} />
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Badge tone={TYPE_TONES[e.type]}>{TYPE_LABELS[e.type]}</Badge>
          <span className="text-sm text-gray-500">
            {formatKstRange(e.starts_at, e.ends_at)}
          </span>
        </div>
        {(e.location || e.address) && (
          <EventLocation location={e.location} address={e.address} />
        )}
        {e.speaker && (
          <p className="text-sm text-gray-700">발표자: {e.speaker}</p>
        )}
        {e.description && <p className="text-sm text-gray-700">{e.description}</p>}
        <p className="text-sm text-gray-500">
          신청 {confirmed}
          {e.capacity ? ` / ${e.capacity}` : ""}명
        </p>
      </Card>
      <RegistrationPanel eventId={e.id} profile={profile} code={code} />
    </div>
  );
}
