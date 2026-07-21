"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

// /admin은 운영진 내부 활동이라 Vercel Analytics·Speed Insights에서도 제외.
// (로컬 dev는 @vercel/* 패키지가 프로덕션에서만 전송해 자동 제외됨)
function dropAdmin<T extends { url: string }>(event: T): T | null {
  try {
    return new URL(event.url).pathname.startsWith("/admin") ? null : event;
  } catch {
    return event;
  }
}

export function VercelAnalytics() {
  return (
    <>
      <Analytics beforeSend={dropAdmin} />
      <SpeedInsights beforeSend={dropAdmin} />
    </>
  );
}
