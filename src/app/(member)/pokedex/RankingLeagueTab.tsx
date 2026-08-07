import { EmptyState } from "@/components/EmptyState";
import { RANKING_LEAGUE_OPEN, RANKING_LEAGUE_PREOPEN } from "@/lib/pokedex/ranking-open";
import type { RankingLeagueState } from "@/lib/pokedex/ranking-league";
import { RankingPreview } from "@/app/ranking-preview/RankingPreview";
import { PokedexBattleTab } from "./PokedexBattleTab";

export function RankingLeagueTab({ profile, state, comingSoon }: { profile: { id: string; name: string; nickname: string | null }; state: RankingLeagueState | null; comingSoon: React.ReactNode }) {
  if (RANKING_LEAGUE_PREOPEN && !RANKING_LEAGUE_OPEN) return state ? <RankingPreview state={state} profile={profile} preopen /> : <EmptyState title="랭킹전을 준비하고 있어요" description="랭킹전 데이터를 불러오지 못했어요." />;
  if (!RANKING_LEAGUE_OPEN) return comingSoon;
  if (!state) return <EmptyState title="랭킹전을 준비하고 있어요" description="데모에서는 랭킹전을 이용할 수 없어요." />;
  return <PokedexBattleTab kind="ranking" profileId={profile.id} state={state} />;
}
