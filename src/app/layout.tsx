import type { Metadata } from "next";
import { DeferredAnalytics } from "@/components/analytics/DeferredAnalytics";
import "./pretendard-subset.css";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "GDG on Campus DJU · 대진대학교 개발자 동아리",
    template: "%s · GDG on Campus DJU",
  },
  description:
    "대진대학교 GDG on Campus(Google Developer Groups) — 배우고, 만들고, 배포하는 학생 개발자 커뮤니티. 정기세션·스터디·모각코·프로젝트로 함께 성장해요.",
  keywords: [
    "GDG", "GDG on Campus", "구글 개발자 그룹", "대진대학교",
    "개발 동아리", "코딩 동아리", "학생 개발자", "GDG DJU",
  ],
  openGraph: {
    type: "website",
    siteName: "GDG on Campus DJU",
    locale: "ko_KR",
    url: siteUrl,
    title: "GDG on Campus DJU · 대진대학교 개발자 동아리",
    description:
      "배우고, 만들고, 배포하는 대진대학교 학생 개발자 커뮤니티. 정기세션·스터디·모각코·프로젝트.",
  },
  twitter: {
    card: "summary_large_image",
    title: "GDG on Campus DJU · 대진대학교 개발자 동아리",
    description:
      "배우고, 만들고, 배포하는 대진대학교 학생 개발자 커뮤니티.",
  },
  alternates: { canonical: "/" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <script
          // ponytail: 하이드레이션 전에 즉시 실행돼야 깜빡임(FOUC) 없음
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme")||"auto";var d=t==="dark"||(t==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        {children}
        <DeferredAnalytics />
      </body>
    </html>
  );
}
