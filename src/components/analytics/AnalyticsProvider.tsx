"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { EVENTS, trackEvent } from "@/lib/analytics";
import { ConsentBanner } from "./ConsentBanner";

type Consent = "granted" | "denied" | "unknown";

const GA_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

export function AnalyticsProvider() {
  const [consent, setConsent] = useState<Consent>("unknown");

  useEffect(() => {
    const stored = localStorage.getItem("analytics-consent");
    if (stored === "granted" || stored === "denied") setConsent(stored);
  }, []);

  function decide(value: "granted" | "denied") {
    localStorage.setItem("analytics-consent", value);
    setConsent(value);
  }

  function trackPendingLogin() {
    const method = sessionStorage.getItem("analytics-login");
    if (!method) return;
    sessionStorage.removeItem("analytics-login");
    trackEvent(EVENTS.login, { method });
  }

  const enabled = consent === "granted";

  return (
    <>
      {enabled && GA_ID && (
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
      {enabled && CLARITY_ID && (
        <Script id="clarity-init" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");`}
        </Script>
      )}
      {consent === "unknown" && (GA_ID || CLARITY_ID) && (
        <ConsentBanner onDecision={decide} />
      )}
    </>
  );
}
