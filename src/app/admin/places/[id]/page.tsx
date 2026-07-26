import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { NaverMap } from "@/components/NaverMap";
import { EventLocation } from "@/components/EventLocation";
import { formatKstDate } from "@/lib/format";
import type { Place } from "@/lib/types";
import { PlaceNotesForm } from "./PlaceNotesForm";

interface PlaceEventRow {
  id: string;
  title: string;
  starts_at: string;
}

export const dynamic = "force-dynamic";

export default async function AdminPlaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  // 데모 모드엔 places 데이터가 없어 목록도 비어 있다 — 상세로 오는 링크 자체가 없다
  if (await isDemoMode()) notFound();

  const supabase = await createClient();
  const { data: placeData } = await supabase
    .from("places")
    .select("*")
    .eq("id", id)
    .single();
  if (!placeData) notFound();
  const place = placeData as Place;

  const { data: eventData } = await supabase
    .from("events")
    .select("id, title, starts_at")
    .eq("place_id", id)
    .order("starts_at", { ascending: false });
  const events = (eventData ?? []) as PlaceEventRow[];

  const coords =
    place.lat != null && place.lng != null
      ? { lat: place.lat, lng: place.lng }
      : null;

  return (
    <div>
      <PageHeader
        title={place.name}
        description={place.address || "주소 미등록"}
        action={
          <Link
            href="/admin/places"
            className="text-sm text-primary hover:underline"
          >
            장소 목록
          </Link>
        }
      />
      <div className="flex flex-col gap-6">
        <Card className="flex flex-col gap-4 overflow-hidden p-0">
          <p className="px-6 pt-6 text-sm font-semibold text-gray-900">위치</p>
          {place.address ? (
            <div className="px-6">
              {/* location=""이면 EventLocation이 이름 줄을 건너뛴다 — 제목에 이미 있다 */}
              <EventLocation location="" address={place.address} />
            </div>
          ) : (
            <p className="px-6 pb-6 text-sm text-gray-500">
              주소를 등록하면 지도에 핀이 찍혀요.
            </p>
          )}
          {/* 키·좌표·주소가 모두 없으면 NaverMap이 null을 반환한다 */}
          <NaverMap coords={coords} address={place.address} heightClass="h-96 lg:h-[32rem]" />
        </Card>

        <Card className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">운영 메모</p>
            <p className="mt-1 text-xs text-gray-400">
              네이버 지도에 없는 정보를 적어두면 이벤트 준비할 때 바로 확인할 수 있어요.
            </p>
          </div>
          <PlaceNotesForm placeId={place.id} notes={place.notes} />
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              이 장소의 이벤트
            </h2>
            <p className="text-xs text-gray-400">최근순 · 총 {events.length}건</p>
          </div>
          {events.length === 0 ? (
            <EmptyState title="이 장소에서 열린 이벤트가 없어요" />
          ) : (
            <ul className="flex flex-col divide-y divide-gray-200">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                >
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="truncate text-sm text-gray-900 hover:underline"
                  >
                    {event.title}
                  </Link>
                  <span className="shrink-0 text-xs text-gray-400">
                    {formatKstDate(event.starts_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
