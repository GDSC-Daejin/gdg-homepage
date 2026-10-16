import { redirect } from "next/navigation";
import "../wds.css";
import "../ranking-preview/ranking-preview.css";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { RankingLeagueState } from "@/lib/pokedex/ranking-league";
import { isRankingLeagueOpen } from "@/lib/pokedex/ranking-open";
import { RankingPreview } from "../ranking-preview/RankingPreview";

export const metadata = { title: "도감 랭킹전", robots: { index: false, follow: false } };

/**
 * 정식 오픈 뒤 회원 랭킹전은 사이드바가 있는 /pokedex/ranking/* 화면을 쓴다.
 * 이 경로는 예전 링크를 그쪽으로 보내고, 오픈 전에만 사전 안내를 보여준다.
 * (RankingPreview는 시안 시뮬레이터라 실제 상태를 넣으면 오류·갱신이 드러나지 않는다.)
 */
export default async function RankingPage() {
  const profile = await requireProfile();
  if (isRankingLeagueOpen()) redirect("/pokedex/ranking");

  const supabase = await createClient();
  const { data } = await supabase.rpc("pokedex_rank_state");
  return <RankingPreview state={data as RankingLeagueState | null} profile={profile} preopen />;
}
