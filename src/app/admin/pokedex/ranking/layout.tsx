import "../../../(member)/pokedex/ranking/ranking.css";
import "./admin-ranking.css";
import { PREVIEW_PROFILE_ID, PREVIEW_STATE } from "@/app/ranking-preview/preview-data";
import { seasonProgress } from "@/lib/pokedex/ranking-stats";
import { RankingBottomNav, RankingTopBar } from "@/app/(member)/pokedex/ranking/RankingChrome";

const ADMIN_RANKING_PATH = "/admin/pokedex/ranking";

export default function AdminRankingLayout({ children }: { children: React.ReactNode }) {
  const season = seasonProgress(PREVIEW_STATE.season, Date.now());

  return <div className="rk rk--admin-preview"><RankingTopBar rank={PREVIEW_STATE.entry?.rank ?? null} rating={PREVIEW_STATE.entry?.rating ?? null} daysLeft={season.daysLeft} basePath={ADMIN_RANKING_PATH} /><div inert>{children}</div><RankingBottomNav basePath={ADMIN_RANKING_PATH} /></div>;
}

export { PREVIEW_PROFILE_ID, PREVIEW_STATE };
