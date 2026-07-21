import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { ProfileForm } from "./ProfileForm";
import { formatKst, monthKst } from "@/lib/format";
import { sumPointsInMonth } from "@/lib/points";
import type {
  RegistrationStatus,
  PointLog,
  Badge as BadgeType,
  EventType,
} from "@/lib/types";

export const dynamic = "force-dynamic";

interface RegistrationHistoryItem {
  id: string;
  status: RegistrationStatus;
  event: { id: string; title: string; starts_at: string } | null;
}

interface MyBadgeItem {
  id: string;
  badge: { id: string } | null;
}

interface AttendanceHistoryItem {
  event_id: string;
  checked_at: string;
  event: { id: string; title: string; type: EventType; starts_at: string } | null;
}

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

export default async function ProfilePage() {
  const profile = await requireProfile();

  const supabase = await createClient();
  const [
    { data: registrations },
    { data: attendances },
    { data: pointLogs },
    { data: myBadges },
    { data: allBadges },
  ] = await Promise.all([
    supabase
      .from("event_registrations")
      .select("id, status, event:events(id, title, starts_at)")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .returns<RegistrationHistoryItem[]>(),
    supabase
      .from("attendances")
      .select("event_id, checked_at, event:events(id, title, type, starts_at)")
      .eq("user_id", profile.id)
      .order("checked_at", { ascending: false })
      .returns<AttendanceHistoryItem[]>(),
    supabase
      .from("point_logs")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .returns<PointLog[]>(),
    supabase
      .from("user_badges")
      .select("id, badge:badges(id)")
      .eq("user_id", profile.id)
      .returns<MyBadgeItem[]>(),
    supabase
      .from("badges")
      .select("*")
      .order("name", { ascending: true })
      .returns<BadgeType[]>(),
  ]);

  const attendedEventIds = new Set((attendances ?? []).map((a) => a.event_id));
  const attendanceHistory = (attendances ?? []).filter((a) => a.event);
  const pointLogList = pointLogs ?? [];
  const pointTotal = pointLogList.reduce((sum, log) => sum + log.amount, 0);
  const monthTotal = sumPointsInMonth(
    pointLogList,
    monthKst(new Date().toISOString()),
  );
  const ownedBadgeIds = new Set(
    (myBadges ?? []).map((ub) => ub.badge?.id).filter(Boolean),
  );
  const badgeCatalog = allBadges ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader title="내 프로필" description="개인 정보를 수정할 수 있어요" />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[400px_1fr] lg:items-start">
        <div className="lg:sticky lg:top-8">
          <ProfileForm profile={profile} />
        </div>

        <div className="flex flex-col gap-8">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="누적 포인트" value={pointTotal} emphasis />
            <StatCard label="이번 달 획득" value={monthTotal} />
            <StatCard label="출석 횟수" value={attendedEventIds.size} />
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-900">신청/출석 이력</h2>
            {registrations && registrations.length > 0 ? (
              <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
                {registrations.map((r) => (
                  <Card
                    key={r.id}
                    className="flex items-center justify-between gap-4 p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {r.event?.title ?? "삭제된 이벤트"}
                      </p>
                      {r.event && (
                        <p className="text-xs text-gray-500">
                          {formatKst(r.event.starts_at)}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Badge tone={r.status === "confirmed" ? "success" : "warning"}>
                        {r.status === "confirmed" ? "확정" : "대기"}
                      </Badge>
                      {r.event && attendedEventIds.has(r.event.id) && (
                        <Badge tone="primary">출석완료</Badge>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState title="신청 내역이 없어요" />
            )}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-900">포인트 내역</h2>
            {pointLogList.length > 0 ? (
              <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
                {pointLogList.slice(0, 10).map((log) => (
                  <Card
                    key={log.id}
                    className="flex items-center justify-between gap-4 p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {log.reason}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatKst(log.created_at)}
                      </p>
                    </div>
                    <p
                      className={
                        log.amount >= 0
                          ? "shrink-0 text-sm font-semibold text-success"
                          : "shrink-0 text-sm font-semibold text-danger"
                      }
                    >
                      {log.amount >= 0 ? `+${log.amount}` : log.amount}
                    </p>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState title="포인트 내역이 없어요" />
            )}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-900">뱃지</h2>
            {badgeCatalog.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {badgeCatalog.map((b) => {
                  const owned = ownedBadgeIds.has(b.id);
                  return (
                    <Card
                      key={b.id}
                      className={`flex items-center gap-3 px-4 py-3 ${
                        owned ? "" : "opacity-45 grayscale"
                      }`}
                    >
                      <span className="text-xl">{b.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {b.name}
                          {owned && (
                            <span className="ml-1.5 text-xs font-normal text-success">
                              획득
                            </span>
                          )}
                        </p>
                        {b.description && (
                          <p className="text-xs text-gray-500">{b.description}</p>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="등록된 뱃지가 없어요" />
            )}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-900">출석 이력</h2>
            {attendanceHistory.length > 0 ? (
              <div className="flex flex-col gap-2">
                {attendanceHistory.map((a) => (
                  <Card
                    key={a.event!.id}
                    className="flex items-center justify-between gap-4 p-4"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Badge tone={TYPE_TONES[a.event!.type]} className="shrink-0">
                        {TYPE_LABELS[a.event!.type]}
                      </Badge>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {a.event!.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatKst(a.event!.starts_at)}
                        </p>
                      </div>
                    </div>
                    <Badge tone="primary" className="shrink-0">출석 완료</Badge>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState title="아직 참석한 활동이 없어요" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
