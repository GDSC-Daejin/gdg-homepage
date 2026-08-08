import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import "../wds.css";
import { getProfile, assertApproved } from "@/lib/auth";
import { hasAuthCookie } from "@/lib/supabase/has-auth-cookie";
import { MemberShell } from "../(member)/MemberShell";
import { HomeDashboard, HomeDashboardSkeleton } from "../(member)/HomeDashboard";
import Landing from "../landing-preview/Landing";

export const dynamic = "force-dynamic";

export const metadata = { title: "GDGOC DJU", alternates: { canonical: "/" } };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const cookieStore = await cookies();
  if (!hasAuthCookie(cookieStore.getAll())) return <Landing />;

  return (
    <Suspense fallback={<HomeLoading />}>
      <AuthenticatedDashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function AuthenticatedDashboard({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const profile = await getProfile();
  if (!profile) return <Landing />;
  if (profile.student_no === "") redirect("/onboarding");
  assertApproved(profile);
  const { month } = await searchParams;

  return (
    <MemberShell profile={profile} contentClassName="max-w-[1520px]">
      <Suspense fallback={<HomeDashboardSkeleton />}>
        <HomeDashboard month={month} nickname={profile.nickname} profileId={profile.id} />
      </Suspense>
    </MemberShell>
  );
}

function HomeLoading() {
  return (
    <main className="mx-auto w-full max-w-[1520px] px-4 py-6 sm:px-8 sm:py-8">
      <HomeDashboardSkeleton />
    </main>
  );
}
