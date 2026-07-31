import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { DEMO_GROUP_MEMBERS, DEMO_GROUPS, DEMO_MEMBERS } from "@/lib/demoData";
import { createClient } from "@/lib/supabase/server";
import type { Group, Profile } from "@/lib/types";
import { AssignGroupMemberForm, GroupActions, RemoveGroupMemberButton } from "../GroupActions";
import { GroupForm } from "../GroupForm";

export const dynamic = "force-dynamic";

export default async function AdminGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const demo = await isDemoMode();
  let group: Group | undefined;
  let roster: Profile[] = [];
  let assignableMembers: Profile[] = [];

  if (demo) {
    group = DEMO_GROUPS.find((item) => item.id === id);
    const memberIds = DEMO_GROUP_MEMBERS
      .filter((member) => member.group_id === id)
      .map((member) => member.user_id);
    roster = DEMO_MEMBERS.filter((member) => memberIds.includes(member.id));
    assignableMembers = DEMO_MEMBERS.filter(
      (member) => member.status === "active" && !memberIds.includes(member.id),
    );
  } else {
    const supabase = await createClient();
    const [{ data: groupData }, { data: members }, { data: profiles }] = await Promise.all([
      supabase.from("groups").select("*").eq("id", id).maybeSingle(),
      supabase.from("group_members").select("user_id, profiles(*)").eq("group_id", id),
      supabase.from("profiles").select("*").eq("status", "active").order("name"),
    ]);
    group = (groupData as Group | null) ?? undefined;
    // profiles는 user_id FK를 타고 오는 1:1이라 배열이 아니라 객체다(RegistrantsTable과 같은 형태).
    roster = ((members ?? []) as unknown as { user_id: string; profiles: Profile | null }[])
      .flatMap((member) => (member.profiles ? [member.profiles] : []));
    const rosterIds = new Set(roster.map((profile) => profile.id));
    assignableMembers = ((profiles as Profile[]) ?? []).filter(
      (profile) => !rosterIds.has(profile.id),
    );
  }

  if (!group) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={group.title} description={`${group.season} · ${roster.length}명`} />
      <GroupActions group={group} />
      <GroupForm group={group} />
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-card sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-700">소속 멤버</h2>
          <span className="text-sm text-gray-500">{roster.length}{group.capacity ? `/${group.capacity}` : ""}명</span>
        </div>
        <AssignGroupMemberForm
          groupId={group.id}
          members={assignableMembers}
          disabled={group.capacity !== null && roster.length >= group.capacity}
        />
        <div className="mt-4 grid gap-2">
          {roster.map((profile) => (
            <div key={profile.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm shadow-card">
              <span>{profile.name}{profile.nickname ? ` (${profile.nickname})` : ""}</span>
              <RemoveGroupMemberButton groupId={group.id} userId={profile.id} />
            </div>
          ))}
          {roster.length === 0 && <p className="text-sm text-gray-400">아직 소속 멤버가 없습니다</p>}
        </div>
      </section>
    </div>
  );
}
