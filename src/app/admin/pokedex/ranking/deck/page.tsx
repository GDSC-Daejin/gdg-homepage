import { RankingScreen } from "@/app/(member)/pokedex/ranking/RankingScreen";
import { PREVIEW_PROFILE_ID, PREVIEW_STATE } from "../layout";

export default function AdminRankingDeckPage() {
  return <RankingScreen page="deck" profileId={PREVIEW_PROFILE_ID} state={PREVIEW_STATE} />;
}
