import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getProfile, assertApproved } from "@/lib/auth";
import { hasAuthCookie } from "@/lib/supabase/has-auth-cookie";
import { MemberShell } from "./(member)/MemberShell";
import { HomeDashboard, HomeDashboardSkeleton } from "./(member)/HomeDashboard";
import Landing from "./landing-preview/Landing";
import { JsonLd } from "@/components/JsonLd";

export const dynamic = "force-dynamic";

export const metadata = { title: "GDGOC DJU", alternates: { canonical: "/" } };

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "GDGOC DJU",
  alternateName: "Google Developer Groups on Campus Daejin University",
  url: siteUrl,
  logo: `${siteUrl}/icon.svg`,
  description: "대진대학교 GDG on Campus — 배우고, 만들고, 배포하는 학생 개발자 커뮤니티",
  parentOrganization: {
    "@type": "CollegeOrUniversity",
    name: "대진대학교",
  },
  // 확정(2026-07-20): 현재 공식 채널 URL 없음 → 빈 배열 유지. 추후 URL만 추가.
  sameAs: [] as string[],
};

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const cookieStore = await cookies();
  if (!hasAuthCookie(cookieStore.getAll())) {
    return (
      <>
        <JsonLd data={organizationLd} />
        <Landing />
      </>
    );
  }

  return (
    <Suspense fallback={<HomeLoading />}>
      <AuthenticatedHome searchParams={searchParams} />
    </Suspense>
  );
}

async function AuthenticatedHome({
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
    <MemberShell profile={profile}>
      <div className="flex flex-col gap-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-card dark:bg-gray-100 sm:gap-10 sm:p-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            안녕하세요, {profile.name}님
          </h1>
        </header>
        <Suspense fallback={<HomeDashboardSkeleton />}>
          <HomeDashboard month={month} profileId={profile.id} />
        </Suspense>
      </div>
    </MemberShell>
  );
}

function HomeLoading() {
  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-8 h-9 w-56 animate-pulse rounded bg-gray-100 dark:bg-gray-100" />
      <HomeDashboardSkeleton />
    </main>
  );
}
