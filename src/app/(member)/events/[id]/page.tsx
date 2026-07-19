import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { RegistrationPanel } from "@/components/RegistrationPanel";
import { formatKst, formatKstRange } from "@/lib/format";
import { EventLocation } from "@/components/EventLocation";
import { NaverMap } from "@/components/NaverMap";
import type { BoardType, Event, EventType } from "@/lib/types";

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
    .select("*, place:places(lat, lng)")
    .eq("id", id)
    .single();

  if (!event) notFound();
  const e = event as Event & { place: { lat: number | null; lng: number | null } | null };

  const { data: countRows } = await supabase.rpc("event_confirmed_counts", {
    p_event_ids: [e.id],
  });
  const confirmed = Number(countRows?.[0]?.confirmed ?? 0);

  const { data: postRows } = await supabase
    .from("posts")
    .select("id, board, title, created_at")
    .eq("event_id", e.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const relatedPosts = (postRows as
    | { id: string; board: BoardType; title: string; created_at: string }[]
    | null) ?? [];

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
        <NaverMap
          coords={
            e.place?.lat != null && e.place?.lng != null
              ? { lat: e.place.lat, lng: e.place.lng }
              : null
          }
          address={e.address || e.location}
        />
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
      {relatedPosts.length > 0 && (
        <Card className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-900">이 이벤트 관련 글</p>
          {relatedPosts.map((post) => (
            <Link
              key={post.id}
              href={`${post.board === "qna" ? "/qna" : "/board"}/${post.id}`}
              className="flex items-center justify-between gap-4 text-sm hover:text-primary"
            >
              <span className="truncate text-gray-700">{post.title}</span>
              <span className="shrink-0 text-xs text-gray-500">
                {formatKst(post.created_at)}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
