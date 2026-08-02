import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { listWorkspaceMembers, type SlackMemberSummary } from "@/lib/slack/api";
import { SlackLinkList, type LinkableMember } from "./SlackLinkList";

export const dynamic = "force-dynamic";

const DEMO_MEMBERS: LinkableMember[] = [
  { id: "p1", name: "옥지훈", email: "jieunsse@gmail.com", slack_user_id: "U04K8FKSNMS" },
  { id: "p2", name: "Yuki", email: "yuki@gmail.com", slack_user_id: null },
];
const DEMO_SLACK: SlackMemberSummary[] = [
  { id: "U04K8FKSNMS", name: "Jayden", email: "jieunsse@gmail.com" },
  { id: "U0B1MBS7TQ9", name: "Yuki", email: "yukionna13@naver.com" },
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
