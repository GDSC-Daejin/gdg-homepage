import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { getProfile } from "@/lib/auth";
import { hashApplicationInviteToken } from "@/lib/application-invite";
import { createClient } from "@/lib/supabase/server";
import { GoogleLoginButton } from "@/app/landing-preview/GoogleLoginButton";
import { LinkAccountButton } from "./LinkAccountButton";

export const dynamic = "force-dynamic";

export default async function OnboardingInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token?.trim();
  if (!token) redirect("/");

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_application_onboarding_invite", {
    p_token_hash: hashApplicationInviteToken(token),
  });
  const invite = (data as {
    application_id: string;
    applicant_name: string;
    email: string;
    season: string;
    expires_at: string;
    used_at: string | null;
    linked_profile_id: string | null;
  }[] | null)?.[0];

  if (!invite) {
    return <InviteMessage title="가입 초대를 찾을 수 없어요" description="링크가 만료됐거나 더 이상 사용할 수 없어요." />;
  }
  if (invite.used_at || invite.linked_profile_id) {
    return <InviteMessage title="이미 사용한 초대 링크예요" description="이미 지원서와 계정이 연결됐어요. 온보딩 화면으로 이동해주세요." />;
  }
  if (new Date(invite.expires_at) <= new Date()) {
    return <InviteMessage title="가입 초대 링크가 만료됐어요" description="운영진에게 초대 링크 재발송을 요청해주세요." />;
  }

  const profile = await getProfile();
  const next = `/onboarding/invite?token=${encodeURIComponent(token)}`;

  return (
    <main className="flex w-full flex-1 justify-center px-4 py-8 lg:items-center lg:py-12">
      <div className="w-full max-w-md">
        <PageHeader title="멤버 가입 초대" description={`${invite.season} 합격자 가입을 진행해요`} />
        <Card className="flex flex-col gap-5 p-6">
          <div className="rounded-lg bg-primary-soft p-4 text-sm text-primary">
            <p className="font-semibold">{invite.applicant_name}님, 합격을 축하드려요!</p>
            <p className="mt-1">지원서에 사용한 이메일 계정으로 가입을 이어가주세요.</p>
          </div>
          {profile ? (
            <>
              <p className="text-sm text-gray-600">현재 로그인한 계정: <span className="font-medium text-gray-900">{profile.email ?? "이메일 확인 불가"}</span></p>
              <LinkAccountButton token={token} />
            </>
          ) : (
            <GoogleLoginButton
              next={next}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            />
          )}
        </Card>
      </div>
    </main>
  );
}

function InviteMessage({ title, description }: { title: string; description: string }) {
  return (
    <main className="flex w-full flex-1 justify-center px-4 py-8 lg:items-center lg:py-12">
      <div className="w-full max-w-md"><PageHeader title={title} description={description} /></div>
    </main>
  );
}
