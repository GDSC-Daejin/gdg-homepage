import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { OnboardingForm } from "./OnboardingForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const profile = await getProfile();
  if (!profile) redirect("/");
  if (profile.student_no !== "") redirect("/");

  return (
    <div className="mx-auto w-full max-w-md">
      <PageHeader
        title="프로필 등록"
        description="동아리 활동을 위해 기본 정보를 입력해주세요"
      />
      <OnboardingForm defaultName={profile.name} />
    </div>
  );
}
