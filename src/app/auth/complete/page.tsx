"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const destination = next === "/admin" || next === "/onboarding" ? next : "/";

  useEffect(() => {
    if (
      localStorage.getItem("analytics-consent") === "granted" &&
      process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID
    ) {
      sessionStorage.setItem("analytics-login", "google");
    }
    router.replace(destination);
  }, [destination, router]);

  return null;
}
