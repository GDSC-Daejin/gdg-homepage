"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { EVENTS, trackEvent } from "@/lib/analytics";

const GA_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
// 로컬 개발환경(next dev, localhost:3000/3001 등)은 수집하지 않음
const IS_PROD = process.env.NODE_ENV === "production";

export function AnalyticsProvider() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;

  // /admin은 운영진 내부 활동이라 분석에서 제외.
  // 유저 페이지 → admin 으로 SPA 이동 시 이미 로드된 gtag의 자동 page_view를
  // GA 공식 차단 플래그로 멈춘다. (직접 진입은 아래 early return으로 스크립트 미로드)
  useEffect(() => {
    if (GA_ID) {
      (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] =
        isAdmin;
    }
  }, [isAdmin]);

  function trackPendingLogin() {
    const method = sessionStorage.getItem("analytics-login");
    if (!method) return;
    sessionStorage.removeItem("analytics-login");
    trackEvent(EVENTS.login, { method });
  }

  if (!IS_PROD || isAdmin) return null;

  return (
    <>
      {GA_ID && (
        <>
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
            onReady={trackPendingLogin}
          />
        </>
      )}
      {CLARITY_ID && (
        <Script id="clarity-init" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");`}
        </Script>
      )}
    </>
  );
}
