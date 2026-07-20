import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  const disallow = ["/admin", "/api", "/auth", "/onboarding", "/interview", "/landing-preview"];
  // (member) 그룹의 실제 URL 경로들 — 인증 게이트 뒤 콘텐츠
  const memberPaths = [
    "/notices", "/board", "/qna", "/surveys", "/materials",
    "/meetings", "/attend", "/inquiries", "/profile", "/events",
  ];
  const blocked = [...disallow, ...memberPaths];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: blocked },
      // 답변엔진(AEO) — 명시 허용으로 인용/색인 유도
      { userAgent: "GPTBot", allow: "/", disallow: blocked },
      { userAgent: "OAI-SearchBot", allow: "/", disallow: blocked },
      { userAgent: "ChatGPT-User", allow: "/", disallow: blocked },
      { userAgent: "PerplexityBot", allow: "/", disallow: blocked },
      { userAgent: "Google-Extended", allow: "/", disallow: blocked },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
