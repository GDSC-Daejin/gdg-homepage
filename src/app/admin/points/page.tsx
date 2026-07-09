import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { formatKst } from "@/lib/format";
import { GrantPointsForm } from "./GrantPointsForm";
import { AwardBadgeForm } from "./AwardBadgeForm";
import { BadgeManager } from "./BadgeManager";
import type { Profile, Event, Badge as BadgeType, PointLog } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPointsPage() {
  await requireAdmin();

  const supabase = await createClient();
  const [
    { data: members },
    { data: events },
    { data: badges },
    { data: logs },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .in("role", ["member", "admin"])
      .eq("status", "active")
      .order("name", { ascending: true }),
    supabase
      .from("events")
      .select("*")
      .order("starts_at", { ascending: false }),
    supabase.from("badges").select("*").order("name", { ascending: true }),
    supabase
      .from("point_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const memberList = (members as Profile[]) ?? [];
  const eventList = (events as Event[]) ?? [];
  const badgeList = (badges as BadgeType[]) ?? [];
  const logList = (logs as PointLog[]) ?? [];

  const logUserIds = Array.from(new Set(logList.map((l) => l.user_id)));
  const { data: logProfiles } = logUserIds.length
    ? await supabase.from("profiles").select("id, name").in("id", logUserIds)
    : { data: [] as { id: string; name: string }[] };
  const nameById = new Map(
    ((logProfiles as { id: string; name: string }[] | null) ?? []).map((p) => [
      p.id,
      p.name,
    ]),
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="포인트/뱃지"
        description="회원에게 포인트와 뱃지를 부여해요"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-gray-900">
            포인트 부여
          </h2>
          <GrantPointsForm members={memberList} events={eventList} />
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-gray-900">
            뱃지 수여
          </h2>
          <AwardBadgeForm members={memberList} badges={badgeList} />
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">뱃지 관리</h2>
        <BadgeManager badges={badgeList} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          최근 포인트 로그
        </h2>
        {logList.length === 0 ? (
          <EmptyState title="포인트 내역이 없어요" />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">회원</th>
                  <th className="px-4 py-3 font-medium">포인트</th>
                  <th className="px-4 py-3 font-medium">사유</th>
                  <th className="px-4 py-3 font-medium">일시</th>
                </tr>
              </thead>
              <tbody>
                {logList.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-gray-900">
                      {nameById.get(log.user_id) || "(탈퇴)"}
                    </td>
                    <td
                      className={
                        log.amount >= 0
                          ? "px-4 py-3 font-medium text-success"
                          : "px-4 py-3 font-medium text-danger"
                      }
                    >
                      {log.amount >= 0 ? `+${log.amount}` : log.amount}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{log.reason}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatKst(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
