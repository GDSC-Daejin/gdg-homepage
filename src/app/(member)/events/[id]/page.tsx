import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCommunity } from "@/lib/community";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { RegistrationPanel } from "@/components/RegistrationPanel";
import { displayName, formatKst } from "@/lib/format";
import { formatEventSchedule } from "@/lib/event-schedule";
import { EventLocation } from "@/components/EventLocation";
import { NaverMap } from "@/components/NaverMap";
import type { BoardType, Event, EventType, RegistrationStatus } from "@/lib/types";

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

const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  confirmed: "확정",
  waitlisted: "대기",
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
  const descriptionParts = e.description.trim().split("💻");
  const supplies =
    e.type === "session" && descriptionParts.length > 1
      ? descriptionParts.pop()?.trim()
      : null;
  const introduction = descriptionParts.join("💻").trim();

  const community = await getCommunity();
  const countRows = await community.events.confirmedCounts([e.id]);
  const confirmed = countRows?.[e.id] ?? 0;

  const { data: registrantRows, error: registrantsError } = await supabase.rpc(
    "event_registrants",
    { p_event_id: e.id },
  );
  const registrants = (registrantRows ?? []) as {
    user_id: string;
    name: string;
    nickname: string;
    status: RegistrationStatus;
  }[];
  const registrantsBlocked =
    !!registrantsError && registrantsError.message.includes("NOT_MEMBER");
  const registrantsFailed = !!registrantsError && !registrantsBlocked;

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
      <PageHeader
        title={e.title}
        action={<Badge tone={TYPE_TONES[e.type]}>{TYPE_LABELS[e.type]}</Badge>}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="divide-y divide-gray-200 p-0 dark:divide-gray-200">
          <div className="p-5">
            <p className="text-sm font-semibold text-gray-900">일시</p>
            <p className="mt-2 text-sm text-gray-700">
              {formatEventSchedule(e)}
            </p>
          </div>
          {(e.location || e.address) && (
            <div className="p-5">
              <p className="text-sm font-semibold text-gray-900">장소</p>
              <div className="mt-2">
                <EventLocation location={e.location} address={e.address} />
              </div>
            </div>
          )}
          {e.speaker && (
            <div className="p-5">
              <p className="text-sm font-semibold text-gray-900">발표자</p>
              <p className="mt-2 text-sm text-gray-700">{e.speaker}</p>
            </div>
          )}
        </Card>
        {(e.location || e.address) && (
          <Card className="flex flex-col gap-4 p-0 overflow-hidden">
            <p className="px-5 pt-5 text-sm font-semibold text-gray-900">오시는 길</p>
            <NaverMap
              coords={
                e.place?.lat != null && e.place?.lng != null
                  ? { lat: e.place.lat, lng: e.place.lng }
                  : null
              }
              address={e.address || e.location}
            />
          </Card>
        )}
      </div>
      <Card className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-semibold text-gray-900">신청 현황</p>
          <p className="text-sm text-gray-700">
            <span className="text-xl font-bold text-primary">{confirmed}</span>
            {e.capacity ? ` / ${e.capacity}` : ""}명
          </p>
        </div>
        {e.capacity && (
          <div
            role="progressbar"
            aria-label="신청 인원"
            aria-valuemin={0}
            aria-valuenow={confirmed}
            aria-valuemax={e.capacity}
            className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-200"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, (confirmed / e.capacity) * 100)}%` }}
            />
          </div>
        )}
        <div className="border-t border-gray-200 pt-3 dark:border-gray-200">
          <p className="text-sm font-semibold text-gray-900">신청한 멤버</p>
          {registrants.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              {registrantsBlocked
                ? "신청자 명단은 멤버만 볼 수 있어요."
                : registrantsFailed
                  ? "명단을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
                  : "아직 신청한 멤버가 없어요."}
            </p>
          ) : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {registrants.map((registrant) => (
                <li
                  key={registrant.user_id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-50"
                >
                  <span className="truncate text-sm font-medium text-gray-900">
                    {displayName(registrant.name || "(이름 없음)", registrant.nickname)}
                  </span>
                  <Badge tone={registrant.status === "confirmed" ? "success" : "neutral"}>
                    {REGISTRATION_STATUS_LABELS[registrant.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
      {(introduction || supplies) && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
            <p className="text-sm font-semibold text-gray-900">세션 소개</p>
          </div>
          <div className="px-5 py-6 sm:px-6">
            <div className="max-w-4xl border-l-2 border-primary pl-4 sm:pl-5">
              {introduction
                .split(/\n+/)
                .filter((paragraph) => paragraph.trim())
                .map((paragraph, index) => (
                  <p
                    key={index}
                    className={`text-[15px] leading-8 text-gray-700 sm:text-base ${index ? "mt-4" : ""}`}
                  >
                    {paragraph}
                  </p>
                ))}
            </div>
            {e.type === "session" && (
              <div className="mt-6 overflow-hidden rounded-lg bg-primary-soft">
                <div className="grid divide-y divide-primary/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                  <div className="p-4">
                    <p className="text-sm font-semibold text-primary">🗓 일시</p>
                    <p className="mt-2 text-sm font-medium leading-6 text-gray-900">{formatEventSchedule(e)}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold text-primary">📍 장소</p>
                    <p className="mt-2 text-sm font-medium leading-6 text-gray-900">{e.location || "장소 미정"}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold text-primary">🚇 오시는 길</p>
                    <p className="mt-2 text-sm font-medium leading-6 text-gray-900">{e.address || "안내 예정"}</p>
                  </div>
                </div>
              </div>
            )}
            {supplies && (
              <div className="mt-6 flex gap-3 border-t border-gray-100 pt-6">
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xl">💻</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">준비물</p>
                  <p className="mt-1 text-[15px] leading-7 text-gray-700 sm:text-base">{supplies}</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
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
