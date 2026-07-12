import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { MemberShell } from "./(member)/MemberShell";
import { HomeDashboard } from "./(member)/HomeDashboard";
import LoginPage from "./login/page";

export const dynamic = "force-dynamic";

export const metadata = { title: "GDG on Campus DJU" };

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const profile = await getProfile();
  if (!profile) return <LoginPage />;
  if (profile.student_no === "") redirect("/onboarding");
  const { month } = await searchParams;

  return (
    <MemberShell profile={profile}>
      <HomeDashboard month={month} />
    </MemberShell>
  );
}
