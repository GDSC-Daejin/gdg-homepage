export type RankingPokemon = {
  throwId: string;
  pokemonId: string;
  name: string;
  imagePath: string;
  combatPower: number;
  battleType: string;
  rarity: "common" | "uncommon" | "rare" | "very_rare" | "legendary";
};

export type RankingPreset = { kind: "attack" | "defense"; slot: number; members: RankingPokemon[] };
export type RankingOpponent = { allocationId: string; name: string; nickname: string | null; lead: RankingPokemon; powerFloor: number };
export type RankingBattleSummary = { id: string; opponentName: string; winnerId: string; attackerDelta: number; defenderDelta: number; createdAt: string };
export type RankingTurn = {
  attackerIndex: number; defenderIndex: number; attackerDamage: number; defenderDamage: number;
  attackerHealth: number; defenderHealth: number; attackerTypeMultiplier: number; defenderTypeMultiplier: number;
  attackerMonoMultiplier: number; defenderMonoMultiplier: number;
};
export type RankingBattleDetail = {
  id: string; attackerId: string; defenderId: string; attackerTeam: RankingPokemon[]; defenderTeam: RankingPokemon[];
  battleLog: RankingTurn[]; winnerId: string; attackerDelta: number; defenderDelta: number; createdAt: string;
};
export type RankingLeagueState = {
  eligible: boolean;
  season: { id: string; startsAt: string; endsAt: string };
  entry: { rating: number; matches: number; attacks: number; attacksToday: number; wins: number; activeDefenseSlot: number | null; defenseEffectiveOn: string | null; rerolled: boolean } | null;
  ownedPokemon: RankingPokemon[];
  presets: RankingPreset[];
  opponents: RankingOpponent[];
  battles: RankingBattleSummary[];
  leaderboard: { rank: number; name: string; nickname: string | null; rating: number }[];
};
