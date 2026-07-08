import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
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

export default async function MemberEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireProfile();
  const { id } = await params;

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
            {formatKst(e.starts_at)}
          </span>
        </div>
        {e.location && (
          <p className="text-sm text-gray-700">장소: {e.location}</p>
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
      <div>{/* Task7: RegistrationPanel */}</div>
    </div>
  );
}
