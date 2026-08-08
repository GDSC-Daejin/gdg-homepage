import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { listWorkspaceMembers, type SlackMemberSummary } from "@/lib/slack/api";
import { SlackLinkList, type LinkableMember } from "./SlackLinkList";

export const dynamic = "force-dynamic";

const DEMO_MEMBERS: LinkableMember[] = [
  { id: "demo-link-1", name: "예시 회원 A", email: "member-a@example.com", slack_user_id: "UDEMO001" },
  { id: "demo-link-2", name: "예시 회원 B", email: "member-b@example.com", slack_user_id: null },
];
const DEMO_SLACK: SlackMemberSummary[] = [
  { id: "UDEMO001", name: "sample-a", email: "member-a@example.com" },
  { id: "UDEMO002", name: "sample-b", email: "member-b@example.com" },
];

export default async function AdminSlackLinksPage() {
  await requireAdmin();

  if (await isDemoMode()) {
    return <Page members={DEMO_MEMBERS} slackMembers={DEMO_SLACK} />;
  }

  const supabase = await createClient();
  const [{ data }, slackMembers] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, email, slack_user_id")
      .in("role", ["member", "organizer", "team_member", "admin"])
      .not("approved_at", "is", null)
      .order("name", { ascending: true }),
    listWorkspaceMembers(),
  ]);

  return <Page members={(data ?? []) as LinkableMember[]} slackMembers={slackMembers} />;
}

function Page({
  members,
  slackMembers,
}: {
  members: LinkableMember[];
  slackMembers: SlackMemberSummary[];
}) {
  return (
    <div>
      <PageHeader
        title="슬랙 계정 연결"
        description="리액션으로 포인트를 받으려면 회원과 슬랙 계정이 연결되어 있어야 해요"
      />
      <SlackLinkList members={members} slackMembers={slackMembers} />
    </div>
  );
}
