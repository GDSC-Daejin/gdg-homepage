import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import type { RankingLeagueState } from "./ranking-league";

/** 2026-09-24(목) 12:00 KST 정식 오픈. 배포는 그 전에 진행한다. */
export const RANKING_LEAGUE_OPEN_AT = "2026-09-24T12:00:00+09:00";
export const RANKING_LEAGUE_PREOPEN = true;

export function isRankingLeagueOpen(now = new Date()): boolean {
  return now.getTime() >= Date.parse(RANKING_LEAGUE_OPEN_AT);
}

/**
 * 랭킹전 상태. 레이아웃(상단바)과 각 페이지가 같이 쓰므로 `cache`로 묶어
 * 한 요청에 RPC가 한 번만 나가게 한다.
 */
export const getRankingState = cache(async (): Promise<RankingLeagueState | null> => {
  if (!isRankingLeagueOpen()) return null;
  if (await isDemoMode()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pokedex_rank_state");
  // 화면은 null이면 "불러오지 못했어요"를 보여준다. 원인은 서버 로그에서 찾을 수 있게 코드만 남긴다.
  if (error) console.error("[pokedex-ranking] 상태 조회 실패", { code: error.code, message: error.message });
  return (data as RankingLeagueState | null) ?? null;
});
