import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { isStaff } from "@/lib/types";
import { signOut } from "@/actions/profile";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const profile = await getProfile();
  if (!profile) redirect("/");
  if (profile.approved_at || isStaff(profile)) redirect("/");
  return (
    <div className="mx-auto w-full max-w-md">
      <PageHeader
        title="승인 대기 중"
        description="가입 신청이 접수되었어요. 운영진 승인 후 회원 기능을 이용할 수 있어요."
      />
      <form action={signOut}>
        <Button type="submit" variant="secondary">로그아웃</Button>
      </form>
    </div>
  );
}
