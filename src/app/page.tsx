import Landing from "./landing-preview/Landing";
import { JsonLd } from "@/components/JsonLd";

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

export default function RootPage() {
  return (
    <>
      <JsonLd data={organizationLd} />
      <Landing />
    </>
  );
}
