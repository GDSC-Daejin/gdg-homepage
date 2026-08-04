import { requireProfile } from "@/lib/auth";
import { getRankingState } from "@/lib/pokedex/ranking-open";
import { RankingScreen } from "./RankingScreen";

export default async function Page() {
  const profile = await requireProfile();
  const state = await getRankingState();
  return <RankingScreen page="home" profileId={profile.id} state={state} />;
}
