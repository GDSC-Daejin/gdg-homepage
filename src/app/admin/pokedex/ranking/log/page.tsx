import { RankingScreen } from "@/app/(member)/pokedex/ranking/RankingScreen";
import { PREVIEW_PROFILE_ID, PREVIEW_STATE } from "../layout";

export default function AdminRankingLogPage() {
  return <RankingScreen page="log" profileId={PREVIEW_PROFILE_ID} state={PREVIEW_STATE} />;
}
