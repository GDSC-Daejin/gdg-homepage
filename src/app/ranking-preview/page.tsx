// WDS 토큰. globals.css의 @import는 Tailwind 파이프라인을 통과하지 못해 여기서 직접 싣는다.
import "../wds.css";
import "./ranking-preview.css";
import { requireAdmin } from "@/lib/auth";
import { RankingPreview } from "./RankingPreview";

export const metadata = {
  title: "랭킹전 시뮬레이터 · GDGOC DJU",
  robots: { index: false, follow: false },
};

// /ranking-preview: 어드민이 예시 데이터로 전체 랭킹전 흐름을 검수하는 시뮬레이터.
export default async function RankingPreviewPage() {
  await requireAdmin();
  return <RankingPreview />;
}
