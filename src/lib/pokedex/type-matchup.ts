import type { BattleType } from "./battle-effects";

/**
 * 타입 상성표. 서버의 `pokedex_rank_type_multiplier`(0078)와 **같은 값이어야 한다** —
 * 두 표가 어긋나면 화면의 "선봉 유리"와 실제 전투 결과가 달라진다.
 * tests/pokedex-type-matchup.test.ts가 SQL 원본과 대조한다.
 *
 * 유리 1.2 / 불리 0.8 / 그 외 1.0. 면역은 쓰지 않는다(설계 "자동 전투와 점수").
 */
const STRONG: Partial<Record<BattleType, BattleType[]>> = {
  normal: [],
  fire: ["grass", "ice", "bug", "steel"],
  water: ["fire", "ground", "rock"],
  electric: ["water", "flying"],
  grass: ["water", "ground", "rock"],
  ice: ["grass", "ground", "flying", "dragon"],
  fighting: ["normal", "ice", "rock", "steel"],
  poison: ["grass", "fairy"],
  ground: ["fire", "electric", "poison", "rock", "steel"],
  flying: ["grass", "fighting", "bug"],
  psychic: ["fighting", "poison"],
  bug: ["grass", "psychic"],
  rock: ["fire", "ice", "flying", "bug"],
  ghost: ["psychic", "ghost"],
  dragon: ["dragon"],
  fairy: ["fighting", "dragon"],
  steel: ["ice", "rock", "fairy"],
};

const WEAK: Partial<Record<BattleType, BattleType[]>> = {
  normal: ["rock", "steel"],
  fire: ["fire", "water", "rock", "dragon"],
  water: ["water", "grass", "dragon"],
  electric: ["electric", "grass", "dragon"],
  grass: ["fire", "grass", "poison", "flying", "bug", "dragon", "steel"],
  ice: ["fire", "water", "ice", "steel"],
  fighting: ["poison", "flying", "psychic", "bug", "fairy"],
  poison: ["poison", "ground", "rock", "ghost"],
  ground: ["grass", "bug"],
  flying: ["electric", "rock", "steel"],
  psychic: ["psychic", "steel"],
  bug: ["fire", "fighting", "poison", "flying", "ghost", "steel", "fairy"],
  rock: ["fighting", "ground", "steel"],
  ghost: [],
  dragon: ["steel"],
  fairy: ["fire", "poison", "steel"],
  steel: ["fire", "water", "electric", "steel"],
};

export function typeMultiplier(attacker: BattleType, defender: BattleType): number {
  if (STRONG[attacker]?.includes(defender)) return 1.2;
  if (WEAK[attacker]?.includes(defender)) return 0.8;
  return 1;
}

export type LeadMatchup = { verdict: "유리" | "호각" | "불리"; tone: "positive" | "neutral" | "negative"; multiplier: number };

/**
 * 내 선봉과 상대 선봉의 상성. **공개된 선봉 한 마리끼리만** 본다 —
 * 상대의 나머지 두 마리는 공개하지 않는 정보라 판정에 넣지 않는다.
 */
export function leadMatchup(mine: BattleType | undefined, theirs: BattleType | undefined): LeadMatchup | null {
  if (!mine || !theirs) return null;
  const multiplier = typeMultiplier(mine, theirs);
  if (multiplier > 1) return { verdict: "유리", tone: "positive", multiplier };
  if (multiplier < 1) return { verdict: "불리", tone: "negative", multiplier };
  return { verdict: "호각", tone: "neutral", multiplier };
}

/** 같은 타입 3마리 파티에 붙는 보너스 (설계 "참가·덱"). */
export const MONO_TYPE_BONUS = 1.1;
