export type PokemonRarity = "common" | "uncommon" | "rare" | "very_rare" | "legendary";

export type PokemonProbabilityRow = {
  pokedex_no: number;
  name_ko: string;
  rarity: PokemonRarity;
  spawn_weight: number;
  catch_rate: number;
};

// 웹 확률표(/pokedex?tab=probabilities)와 슬랙 도감봇이 함께 쓰는 값이다.
export const RARITY_PROBABILITY: Record<PokemonRarity, { label: string; weight: number; catchRate: number }> = {
  common: { label: "일반", weight: 100, catchRate: 70 },
  uncommon: { label: "흔치않음", weight: 55, catchRate: 60 },
  rare: { label: "희귀", weight: 25, catchRate: 48 },
  very_rare: { label: "매우 희귀", weight: 12, catchRate: 36 },
  legendary: { label: "전설/환상", weight: 8, catchRate: 28 },
};

export function catchRatePercent(catchRate: number) {
  return Math.round(catchRate * 100);
}

export function spawnSharePercent(spawnWeight: number, totalWeight: number) {
  if (totalWeight <= 0) return 0;
  return Math.round((spawnWeight / totalWeight) * 1000) / 10;
}
