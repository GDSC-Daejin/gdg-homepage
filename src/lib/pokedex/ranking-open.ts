import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import type { RankingLeagueState } from "./ranking-league";

/**
 * 랭킹전 오픈 스위치. 운영자가 열라고 하면 이 값만 true로 바꾼다
 * (설계 "도감 랭킹전 사전 안내" — 오픈 방법).
 */
export const RANKING_LEAGUE_OPEN = false;

/**
 * 랭킹전 상태. 레이아웃(상단바)과 각 페이지가 같이 쓰므로 `cache`로 묶어
 * 한 요청에 RPC가 한 번만 나가게 한다.
 */
export const getRankingState = cache(async (): Promise<RankingLeagueState | null> => {
  if (!RANKING_LEAGUE_OPEN) return null;
  if (await isDemoMode()) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("pokedex_rank_state");
  return (data as RankingLeagueState | null) ?? null;
});
