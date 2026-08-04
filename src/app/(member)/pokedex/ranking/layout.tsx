import { redirect } from "next/navigation";
import "./ranking.css";
import { RANKING_LEAGUE_OPEN, getRankingState } from "@/lib/pokedex/ranking-open";
import { seasonProgress } from "@/lib/pokedex/ranking-stats";
import { RankingBottomNav, RankingTopBar } from "./RankingChrome";

export const metadata = { title: "도감 랭킹전", robots: { index: false, follow: false } };

/**
 * 랭킹전 전용 껍데기. 상단 4탭이 유일한 탭이 되도록 도감 탭바 밖에 둔다.
 * 상태는 `getRankingState`가 요청당 한 번만 부르므로 각 페이지가 다시 불러도 RPC는 한 번이다.
 */
export default async function RankingLayout({ children }: { children: React.ReactNode }) {
  // 오픈 전에는 도감 탭의 사전 안내로 돌려보낸다.
  if (!RANKING_LEAGUE_OPEN) redirect("/pokedex?tab=ranking");

  const state = await getRankingState();
  const season = state ? seasonProgress(state.season, Date.now()) : null;

  return (
    <div className="rk">
      <RankingTopBar
        rank={state?.entry?.rank ?? null}
        rating={state?.entry?.rating ?? null}
        daysLeft={season?.daysLeft ?? null}
      />
      {children}
      <RankingBottomNav />
    </div>
  );
}
