// WDS 토큰. globals.css의 @import는 Tailwind 파이프라인을 통과하지 못해 여기서 직접 싣는다.
import "./wds.css";
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
    <MemberShell profile={profile} contentClassName="max-w-[1520px]">
      <Suspense fallback={<HomeDashboardSkeleton />}>
        <HomeDashboard month={month} name={profile.name} profileId={profile.id} />
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
