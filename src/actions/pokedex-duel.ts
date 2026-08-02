"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { toKoreanError } from "@/lib/errors";
import type { BattleType } from "@/lib/pokedex/battle-effects";
import type { PokemonDuel } from "@/lib/pokedex/duel";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

function refresh() {
  revalidatePath("/pokedex");
}

export async function createPokemonDuel(opponentId: string, throwId: string): Promise<ActionResult> {
  await requireProfile();
  if (await isDemoMode()) return { error: "데모에서는 결투를 신청할 수 없어요" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("pokedex_duel_create", { p_opponent: opponentId, p_throw: throwId });
  if (error) return { error: toKoreanError(error) };
  refresh();
  return {};
}

export async function acceptPokemonDuel(duelId: string, throwId: string): Promise<ActionResult & { duel?: PokemonDuel }> {
  await requireProfile();
  if (await isDemoMode()) return { error: "데모에서는 결투를 수락할 수 없어요" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pokedex_duel_accept", { p_duel: duelId, p_throw: throwId });
  if (error || !data) return { error: toKoreanError(error) };
  const result = data as {
    id: string; winner_id: string;
    challenger: { user_id: string; name: string; nickname: string | null; avatar_path: string | null; battle_type: BattleType; pokemon_name: string; image_path: string; combat_power: number; score: number };
    opponent: { user_id: string; name: string; nickname: string | null; avatar_path: string | null; battle_type: BattleType; pokemon_name: string; image_path: string; combat_power: number; score: number };
  };
  refresh();
  return {
    duel: {
      id: result.id,
      status: "accepted",
      createdAt: new Date().toISOString(),
      winnerId: result.winner_id,
      challenger: { userId: result.challenger.user_id, name: result.challenger.name, nickname: result.challenger.nickname, avatarPath: result.challenger.avatar_path, battleType: result.challenger.battle_type, pokemonName: result.challenger.pokemon_name, imagePath: result.challenger.image_path, combatPower: result.challenger.combat_power, score: result.challenger.score },
      opponent: { userId: result.opponent.user_id, name: result.opponent.name, nickname: result.opponent.nickname, avatarPath: result.opponent.avatar_path, battleType: result.opponent.battle_type, pokemonName: result.opponent.pokemon_name, imagePath: result.opponent.image_path, combatPower: result.opponent.combat_power, score: result.opponent.score },
    },
  };
}

export async function rejectPokemonDuel(duelId: string): Promise<ActionResult> {
  await requireProfile();
  if (await isDemoMode()) return { error: "데모에서는 결투를 거절할 수 없어요" };
  const { error } = await (await createClient()).rpc("pokedex_duel_reject", { p_duel: duelId });
  if (error) return { error: toKoreanError(error) };
  refresh();
  return {};
}

export async function cancelPokemonDuel(duelId: string): Promise<ActionResult> {
  await requireProfile();
  if (await isDemoMode()) return { error: "데모에서는 결투를 취소할 수 없어요" };
  const { error } = await (await createClient()).rpc("pokedex_duel_cancel", { p_duel: duelId });
  if (error) return { error: toKoreanError(error) };
  refresh();
  return {};
}
