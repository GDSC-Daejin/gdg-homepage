import Landing from "./Landing";

export const metadata = { title: "랜딩 디자인 프리뷰 · GDG on Campus DJU" };

// /landing-preview: 디자인 프리뷰 전용. 실제 랜딩은 루트(/)에서 렌더됨
export default function LandingPreviewPage() {
  return <Landing />;
}
