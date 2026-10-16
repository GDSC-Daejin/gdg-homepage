"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { toKoreanError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import type { RankingBattleDetail } from "@/lib/pokedex/ranking-league";

function refresh() {
  // 랭킹전 화면은 /pokedex/ranking/* 하위 페이지라 레이아웃 단위로 갱신해야 공격·덱 화면도 새 상태를 받는다.
  revalidatePath("/pokedex", "layout");
  revalidatePath("/ranking");
}

async function rankingClient() {
  await requireProfile();
  if (await isDemoMode()) return null;
  return createClient();
}

export async function joinRankingLeague(): Promise<ActionResult> {
  const supabase = await rankingClient();
  if (!supabase) return { error: "데모에서는 랭킹전에 참가할 수 없어요" };
  const { error } = await supabase.rpc("pokedex_rank_join");
  if (error) return { error: toKoreanError(error) };
  refresh();
  return {};
}

export async function saveRankingPreset(kind: "attack" | "defense", slot: number, throwIds: string[]): Promise<ActionResult> {
  const supabase = await rankingClient();
  if (!supabase) return { error: "데모에서는 프리셋을 저장할 수 없어요" };
  const { error } = await supabase.rpc("pokedex_rank_save_preset", { p_kind: kind, p_slot: slot, p_throw_ids: throwIds });
  if (error) return { error: toKoreanError(error) };
  refresh();
  return {};
}

export async function activateRankingDefense(slot: number): Promise<ActionResult> {
  const supabase = await rankingClient();
  if (!supabase) return { error: "데모에서는 방어 덱을 활성화할 수 없어요" };
  const { error } = await supabase.rpc("pokedex_rank_activate_defense", { p_slot: slot });
  if (error) return { error: toKoreanError(error) };
  refresh();
  return {};
}

export async function activateRankingAttack(slot: number): Promise<ActionResult> {
  const supabase = await rankingClient();
  if (!supabase) return { error: "데모에서는 공격 덱을 활성화할 수 없어요" };
  const { error } = await supabase.rpc("pokedex_rank_activate_attack", { p_slot: slot });
  if (error) return { error: toKoreanError(error) };
  refresh();
  return {};
}

export async function rerollRankingOpponents(): Promise<ActionResult> {
  const supabase = await rankingClient();
  if (!supabase) return { error: "데모에서는 상대를 리롤할 수 없어요" };
  const { error } = await supabase.rpc("pokedex_rank_reroll");
  if (error) return { error: toKoreanError(error) };
  refresh();
  return {};
}

export async function startRankingBattle(allocationId: string, attackPresetSlot: number): Promise<ActionResult & { battle?: RankingBattleDetail }> {
  const supabase = await rankingClient();
  if (!supabase) return { error: "데모에서는 랭킹전을 시작할 수 없어요" };
  const { data, error } = await supabase.rpc("pokedex_rank_start_battle", { p_allocation: allocationId, p_attack_slot: attackPresetSlot });
  if (error || !data) return { error: toKoreanError(error) };
  refresh();
  const battle = data as RankingBattleDetail;
  // 0124 이전 RPC는 팀 없이 결과만 돌려준다. 재생 화면은 양측 팀이 있어야 그려지므로 상세를 다시 읽는다.
  if (Array.isArray(battle.attackerTeam) && Array.isArray(battle.defenderTeam)) return { battle };
  return getRankingBattleDetail(battle.id);
}

export async function getRankingBattleDetail(battleId: string): Promise<ActionResult & { battle?: RankingBattleDetail }> {
  const supabase = await rankingClient();
  if (!supabase) return { error: "데모에서는 전투 기록을 조회할 수 없어요" };
  const { data, error } = await supabase.rpc("pokedex_rank_battle_detail", { p_battle: battleId });
  if (error || !data) return { error: toKoreanError(error) };
  return { battle: data as RankingBattleDetail };
}
