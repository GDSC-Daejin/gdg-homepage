import type { BattleType } from "@/lib/pokedex/battle-effects";

export type DuelParticipant = { userId: string; name: string; nickname: string | null; avatarPath: string | null; battleType: BattleType; pokemonName: string | null; imagePath: string | null; combatPower: number | null; score?: number | null };
export type PokemonDuel = {
  id: string;
  status: "pending" | "accepted" | "rejected" | "canceled";
  createdAt: string;
  winnerId: string | null;
  challenger: DuelParticipant;
  opponent: DuelParticipant;
};
export type OwnedBattlePokemon = { id: string; pokemonName: string; imagePath: string; combatPower: number };
export type DuelMember = { id: string; name: string; nickname: string | null; avatarPath: string | null };
