import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { isStaff } from "@/lib/types";
import { signOut } from "@/actions/profile";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { OnboardingForm } from "./OnboardingForm";

export const dynamic = "force-dynamic";

/**
 * 승인 전 회원이 머무는 유일한 화면.
 * 제출 전에는 프로필 등록 폼, 제출 후에는 대기 안내 + 같은 폼(오타 수정용)을 보여준다.
 * 두 화면으로 갈라두면 "내 신청이 어디까지 갔나"를 확인할 곳이 없다.
 */
export default async function OnboardingPage() {
  const profile = await getProfile();
  if (!profile) redirect("/");
  if (profile.approved_at || isStaff(profile)) redirect("/");

  const submitted = profile.student_no !== "";

  return (
    <main className="flex w-full flex-1 justify-center px-4 py-8 lg:items-center lg:py-12">
      <div className="w-full max-w-md">
        <PageHeader
          title={submitted ? "승인 대기 중" : "프로필 등록"}
          description={
            submitted
              ? "가입 신청이 접수되었어요. 운영진 승인 후 회원 기능을 이용할 수 있어요."
              : "동아리 활동을 위해 기본 정보를 입력해주세요"
          }
        />

        {submitted && (
          <p className="mb-4 rounded-md bg-primary-soft px-3 py-2.5 text-sm text-primary">
            승인 전까지는 아래에서 입력한 내용을 고칠 수 있어요.
          </p>
        )}

        <OnboardingForm profile={profile} submitted={submitted} />

        {submitted && (
          <form action={signOut} className="mt-4">
            <Button type="submit" variant="ghost" className="w-full">
              로그아웃
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
