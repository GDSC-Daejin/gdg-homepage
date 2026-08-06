import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { SectionTabs, MEMBER_TABS } from "../SectionTabs";
import { EmptyState } from "@/components/EmptyState";
import { GrantPointsForm } from "./GrantPointsForm";
import { AwardBadgeForm } from "./AwardBadgeForm";
import { BadgeManager } from "./BadgeManager";
import { PointLogTable } from "./PointLogTable";
import type { Profile, Event, Badge as BadgeType, PointLog } from "@/lib/types";
import { isDemoMode } from "@/lib/demo";
import { displayName } from "@/lib/format";
import { DEMO_MEMBERS, DEMO_EVENTS, DEMO_BADGES, DEMO_POINT_LOGS } from "@/lib/demoData";

export const dynamic = "force-dynamic";

export default async function AdminPointsPage() {
  await requireAdmin();
  const demo = await isDemoMode();

  let memberList: Profile[] = DEMO_MEMBERS.filter(
    (m) => m.role !== "applicant" && m.status === "active" && m.approved_at,
  );
  let eventList: Event[] = DEMO_EVENTS;
  let badgeList: BadgeType[] = DEMO_BADGES;
  let logList: PointLog[] = DEMO_POINT_LOGS;
  let nameById = new Map(
    DEMO_MEMBERS.map((m) => [m.id, displayName(m.name, m.nickname)]),
  );

  if (!demo) {
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
        .in("role", ["member", "organizer", "team_member"])
        .eq("status", "active")
        .not("approved_at", "is", null)
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

    memberList = (members as Profile[]) ?? [];
    eventList = (events as Event[]) ?? [];
    badgeList = (badges as BadgeType[]) ?? [];
    logList = (logs as PointLog[]) ?? [];

    const logUserIds = Array.from(new Set(logList.map((l) => l.user_id)));
    const { data: logProfiles } = logUserIds.length
      ? await supabase.from("profiles").select("id, name, nickname").in("id", logUserIds)
      : { data: [] as { id: string; name: string; nickname: string }[] };
    nameById = new Map(
      ((logProfiles as { id: string; name: string; nickname: string }[] | null) ?? []).map(
        (p) => [p.id, displayName(p.name, p.nickname)],
      ),
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <SectionTabs tabs={MEMBER_TABS} label="회원" />
      <PageHeader
        title="포인트/뱃지"
        description="회원에게 포인트와 뱃지를 부여해요"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GrantPointsForm members={memberList} events={eventList} />
        <AwardBadgeForm members={memberList} badges={badgeList} />
      </div>

      <div>
        <BadgeManager badges={badgeList} />
      </div>

      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              최근 포인트 로그
            </h2>
            <p className="text-sm text-gray-500">
              최근 지급·차감 내역을 참고용으로 확인해요
            </p>
          </div>
          <p className="text-xs text-gray-400">최근 50건 표시</p>
        </div>
        {logList.length === 0 ? (
          <EmptyState
            icon={
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                <path d="M4 5.5h12M4 10h12M4 14.5h8" />
                <circle cx="16" cy="14.5" r="1" />
              </svg>
            }
            title="포인트 내역이 없어요"
            description="포인트를 부여하면 이곳에 지급·차감 기록이 쌓여요."
          />
        ) : (
          <PointLogTable
            logs={logList}
            nameById={Object.fromEntries(nameById)}
          />
        )}
      </div>
    </div>
  );
}
