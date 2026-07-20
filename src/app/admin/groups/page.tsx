import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { DEMO_GROUP_MEMBERS, DEMO_GROUPS } from "@/lib/demoData";
import { createClient } from "@/lib/supabase/server";
import type { Group } from "@/lib/types";
import { GroupForm } from "./GroupForm";

export const dynamic = "force-dynamic";

const TYPE_LABEL = { study: "스터디", project: "프로젝트" } as const;
const STATUS_LABEL = { recruiting: "모집중", active: "진행중", archived: "종료" } as const;

export default async function AdminGroupsPage() {
  await requireAdmin();
  const demo = await isDemoMode();
  let groups: Group[] = DEMO_GROUPS;
  let counts = countMembers(DEMO_GROUP_MEMBERS.map((member) => member.group_id));

  if (!demo) {
    const supabase = await createClient();
    const [{ data }, { data: members }] = await Promise.all([
      supabase.from("groups").select("*").order("created_at", { ascending: false }),
      supabase.from("group_members").select("group_id"),
    ]);
    groups = (data ?? []) as Group[];
    counts = countMembers((members ?? []).map((member) => member.group_id));
  }

  return (
    <div className="space-y-6">
      <PageHeader title="스터디·프로젝트" description="그룹을 만들고 소속 명단을 확인합니다" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:items-start">
        <GroupForm />
        <Card className="flex min-h-[30rem] flex-col p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold tracking-tight text-gray-900">그룹 목록</h2>
            <Badge tone="primary">{groups.length}개</Badge>
          </div>
          <div className="mt-5 flex-1">
            {groups.length === 0 ? (
              <EmptyState
                title="아직 그룹이 없어요"
                description="왼쪽에서 첫 그룹을 만들어 보세요"
                icon={<GroupIcon />}
                className="h-full min-h-[23rem] !border-primary-soft !bg-primary-soft !shadow-none [&>div:first-child]:mb-4 [&>div:first-child]:h-auto [&>div:first-child]:w-auto [&>div:first-child]:rounded-none [&>div:first-child]:!bg-transparent"
              />
            ) : (
              <div className="grid gap-3">
                {groups.map((group) => (
                  <Link key={group.id} href={`/admin/groups/${group.id}`} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4 transition-[border-color,box-shadow] hover:border-primary hover:shadow-card dark:bg-gray-50">
                    <div className="min-w-0">
                      <span className="text-xs text-gray-500">{TYPE_LABEL[group.type]} · {group.season}</span>
                      <div className="truncate font-semibold text-gray-900">{group.title}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-sm text-gray-500">
                      <span>{STATUS_LABEL[group.status]}</span>
                      <span>{counts[group.id] ?? 0}{group.capacity ? `/${group.capacity}` : ""}명</span>
                      {group.is_public && <span className="text-success">공개</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function GroupIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-12 w-12 text-primary">
      <circle cx="14" cy="17" r="3.5" />
      <circle cx="24" cy="14" r="4.5" />
      <circle cx="34" cy="17" r="3.5" />
      <path d="M6 37a8 8 0 0 1 16 0M15 37a9 9 0 0 1 18 0M26 37a8 8 0 0 1 16 0" strokeLinecap="round" />
    </svg>
  );
}

function countMembers(ids: string[]): Record<string, number> {
  return ids.reduce<Record<string, number>>((counts, id) => {
    counts[id] = (counts[id] ?? 0) + 1;
    return counts;
  }, {});
}
