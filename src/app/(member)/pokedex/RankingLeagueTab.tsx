import { isRankingLeagueOpen, RANKING_LEAGUE_PREOPEN } from "@/lib/pokedex/ranking-open";
import type { RankingLeagueState } from "@/lib/pokedex/ranking-league";
import { seasonProgress } from "@/lib/pokedex/ranking-stats";
import { RankingBottomNav, RankingTopBar } from "./ranking/RankingChrome";
import { RankingScreen } from "./ranking/RankingScreen";

export function RankingLeagueTab({ profile, state, comingSoon }: { profile: { id: string; name: string; nickname: string | null }; state: RankingLeagueState | null; comingSoon: React.ReactNode }) {
  const open = isRankingLeagueOpen();
  if (RANKING_LEAGUE_PREOPEN && !open) {
    const season = state ? seasonProgress(state.season, Date.now()) : null;
    return (
      <div className="rk">
        <RankingTopBar rank={null} rating={null} daysLeft={season?.daysLeft ?? null} />
        {state ? <RankingScreen page="home" profileId={profile.id} state={state} readOnly /> : <main className="rk-inner rk-page"><div className="rk-card"><span className="rk-cardtitle">랭킹전을 준비하고 있어요</span><p className="rk-cardsub">랭킹전 데이터를 불러오지 못했어요.</p></div></main>}
        <RankingBottomNav />
      </div>
    );
  }
  if (!open) return comingSoon;
  return <RankingScreen page="home" profileId={profile.id} state={state} />;
}
