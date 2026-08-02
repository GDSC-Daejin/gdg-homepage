import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getProfile, assertApproved } from "@/lib/auth";
import { MemberShell } from "./(member)/MemberShell";
import { HomeDashboard, HomeDashboardSkeleton } from "./(member)/HomeDashboard";
import Landing from "./landing-preview/Landing";
import { JsonLd } from "@/components/JsonLd";

export const dynamic = "force-dynamic";

export const metadata = { title: "GDG on Campus DJU", alternates: { canonical: "/" } };

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "GDG on Campus DJU",
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
  const profile = await getProfile();
  if (!profile)
    return (
      <>
        <JsonLd data={organizationLd} />
        <Landing />
      </>
    );
  if (profile.student_no === "") redirect("/onboarding");
  assertApproved(profile);
  const { month } = await searchParams;

  return (
    <MemberShell profile={profile}>
      <div className="flex flex-col gap-8 sm:gap-10">
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
