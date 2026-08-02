"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { toKoreanError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import type { RankingBattleDetail } from "@/lib/pokedex/ranking-league";

function refresh() {
  revalidatePath("/pokedex");
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
  return { battle: data as RankingBattleDetail };
}

export async function getRankingBattleDetail(battleId: string): Promise<ActionResult & { battle?: RankingBattleDetail }> {
  const supabase = await rankingClient();
  if (!supabase) return { error: "데모에서는 전투 기록을 조회할 수 없어요" };
  const { data, error } = await supabase.rpc("pokedex_rank_battle_detail", { p_battle: battleId });
  if (error || !data) return { error: toKoreanError(error) };
  return { battle: data as RankingBattleDetail };
}
