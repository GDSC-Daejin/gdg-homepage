import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getRecruitingSettings } from "@/lib/recruiting";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { POSITION_LABELS, type Position } from "@/lib/types";
import { InviteResendButton } from "./InviteResendButton";
import { isDemoMode } from "@/lib/demo";
import { DEMO_APPLICATIONS, DEMO_APPLICATION_ONBOARDING_INVITES, DEMO_MEMBERS, DEMO_RECRUITING_SETTINGS } from "@/lib/demoData";

export const dynamic = "force-dynamic";

type ApplicationRow = {
  id: string;
  applicant_name: string;
  email: string;
  season: string;
  position: Position | null;
  applicant_id: string | null;
};

type InviteRow = {
  application_id: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
  }).format(new Date(iso));
}

export default async function ApplicationConversionsPage() {
  const admin = await requireAdmin();
  const demo = await isDemoMode();
  const settings = demo ? DEMO_RECRUITING_SETTINGS : await getRecruitingSettings();
  let rows: ApplicationRow[];
  let invites: InviteRow[];
  let profiles: { id: string; approved_at: string | null }[];

  if (demo) {
    rows = DEMO_APPLICATIONS
      .filter((application) => application.season === settings.season && application.status === "accepted")
      .map(({ id, applicant_name, email, season, position, applicant_id }) => ({ id, applicant_name, email, season, position, applicant_id }));
    invites = DEMO_APPLICATION_ONBOARDING_INVITES;
    profiles = DEMO_MEMBERS
      .filter((member) => rows.some((row) => row.applicant_id === member.id))
      .map(({ id, approved_at }) => ({ id, approved_at }));
  } else {
    const supabase = await createClient();
    const { data: applications } = await supabase
      .from("applications")
      .select("id, applicant_name, email, season, position, applicant_id")
      .eq("season", settings.season)
      .eq("status", "accepted")
      .order("applicant_name");
    rows = (applications ?? []) as ApplicationRow[];
    const ids = rows.map((row) => row.id);
    const profileIds = rows.flatMap((row) => (row.applicant_id ? [row.applicant_id] : []));
    const [{ data: inviteData }, { data: profileData }] = ids.length
      ? await Promise.all([
          supabase
            .from("application_onboarding_invites")
            .select("application_id, expires_at, used_at, revoked_at, created_at")
            .in("application_id", ids)
            .order("created_at", { ascending: false }),
          profileIds.length
            ? supabase.from("profiles").select("id, approved_at").in("id", profileIds)
            : Promise.resolve({ data: [] }),
        ])
      : [{ data: [] }, { data: [] }];
    invites = (inviteData ?? []) as InviteRow[];
    profiles = (profileData ?? []) as { id: string; approved_at: string | null }[];
  }

  const latestInvite = new Map<string, InviteRow>();
  for (const invite of invites) {
    if (!latestInvite.has(invite.application_id)) latestInvite.set(invite.application_id, invite);
  }
  const approvalByProfile = new Map(
    profiles.map((profile) => [profile.id, profile.approved_at]),
  );

  return (
    <div>
      <PageHeader
        title="합격자 가입 전환"
        description={`${settings.season} 합격자의 초대·계정 연결·승인 상태를 관리해요`}
        action={<span className="text-sm text-gray-500">운영진 {admin.name}</span>}
      />
      {rows.length === 0 ? (
        <Card><p className="text-sm text-gray-500">현재 시즌 합격자가 없어요.</p></Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">합격자</th>
                  <th className="px-4 py-3 font-medium">포지션</th>
                  <th className="px-4 py-3 font-medium">전환 상태</th>
                  <th className="px-4 py-3 font-medium">초대 만료</th>
                  <th className="px-4 py-3 text-right font-medium">관리</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((application) => {
                  const invite = latestInvite.get(application.id);
                  const approvedAt = application.applicant_id
                    ? approvalByProfile.get(application.applicant_id)
                    : undefined;
                  const status = approvedAt
                    ? { label: "승인 완료", tone: "success" as const }
                    : application.applicant_id
                      ? { label: "승인 대기", tone: "warning" as const }
                      : invite && new Date(invite.expires_at) > new Date()
                        ? { label: invite.used_at ? "계정 연결" : "초대 발송", tone: "primary" as const }
                        : invite
                          ? { label: "초대 만료", tone: "danger" as const }
                          : { label: "초대 전", tone: "neutral" as const };

                  return (
                    <tr key={application.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/admin/applications/${application.id}`} className="font-medium text-primary hover:underline">
                          {application.applicant_name}
                        </Link>
                        <p className="text-xs text-gray-500">{application.email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {application.position ? POSITION_LABELS[application.position] : "미지정"}
                      </td>
                      <td className="px-4 py-3"><Badge tone={status.tone}>{status.label}</Badge></td>
                      <td className="px-4 py-3 text-gray-600">
                        {invite && !invite.used_at && !invite.revoked_at ? formatDate(invite.expires_at) : "-"}
                      </td>
                      <td className="px-4 py-3"><InviteResendButton applicationId={application.id} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
