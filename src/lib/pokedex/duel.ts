import type { BattleType } from "@/lib/pokedex/battle-effects";

export type DuelParticipant = { userId: string; name: string; nickname: string | null; avatarPath: string | null; battleType: BattleType; pokemonName: string | null; imagePath: string | null; combatPower: number | null; score?: number | null };
export type DuelTurn = { actor: "challenger" | "opponent"; damage: number; challengerHealth: number; opponentHealth: number };
export type PokemonDuel = {
  id: string;
  status: "pending" | "accepted" | "rejected" | "canceled";
  createdAt: string;
  winnerId: string | null;
  firstTurnUserId?: string | null;
  battleLog?: DuelTurn[];
  challenger: DuelParticipant;
  opponent: DuelParticipant;
};

export function findAcceptedDuel(waitingDuelIds: ReadonlySet<string>, duels: readonly PokemonDuel[]) {
  return duels.find((duel) => waitingDuelIds.has(duel.id) && duel.status === "accepted");
}

export type OwnedBattlePokemon = { id: string; pokemonName: string; imagePath: string; combatPower: number };
export type DuelMember = { id: string; name: string; nickname: string | null; avatarPath: string | null };
