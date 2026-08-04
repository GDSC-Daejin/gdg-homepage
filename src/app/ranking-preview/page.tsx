// WDS 토큰. globals.css의 @import는 Tailwind 파이프라인을 통과하지 못해 여기서 직접 싣는다.
import "../wds.css";
import "./ranking-preview.css";
import { RankingPreview } from "./RankingPreview";

export const metadata = {
  title: "랭킹전 디자인 프리뷰 · GDGOC DJU",
  robots: { index: false, follow: false },
};

// /ranking-preview: 도감 랭킹전 리디자인 시안 확인용. 실제 랭킹전은 /pokedex?tab=ranking
export default function RankingPreviewPage() {
  return <RankingPreview />;
}
