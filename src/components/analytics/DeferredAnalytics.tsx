"use client";

import dynamic from "next/dynamic";

const AnalyticsProvider = dynamic(
  () => import("./AnalyticsProvider").then((module) => module.AnalyticsProvider),
  { ssr: false },
);
const VercelAnalytics = dynamic(
  () => import("./VercelAnalytics").then((module) => module.VercelAnalytics),
  { ssr: false },
);

export function DeferredAnalytics() {
  return (
    <>
      <AnalyticsProvider />
      <VercelAnalytics />
    </>
  );
}
