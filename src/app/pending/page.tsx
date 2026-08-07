import { permanentRedirect } from "next/navigation";

/** 승인 대기 안내는 온보딩 화면으로 합쳤다 — 기존 링크·북마크를 위해 경로만 남긴다. */
export default function PendingPage() {
  permanentRedirect("/onboarding");
}
