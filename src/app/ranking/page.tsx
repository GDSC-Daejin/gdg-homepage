import "../wds.css";
import "../ranking-preview/ranking-preview.css";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { RankingLeagueState } from "@/lib/pokedex/ranking-league";
import { isRankingLeagueOpen } from "@/lib/pokedex/ranking-open";
import { RankingPreview } from "../ranking-preview/RankingPreview";

export const metadata = { title: "도감 랭킹전", robots: { index: false, follow: false } };

export default async function RankingPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.rpc("pokedex_rank_state");

  return <RankingPreview state={data as RankingLeagueState | null} profile={profile} preopen={!isRankingLeagueOpen()} />;
}
