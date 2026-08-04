import type { BattleType } from "./battle-effects";
import type { RankingPokemon } from "./ranking-league";
import { MONO_TYPE_BONUS } from "./type-matchup";

/**
 * 덱 추천. **오늘의 상대 정보를 쓰지 않는다** — 내 보유 포켓몬과 게임 규칙만 본다.
 * 상대를 저격하는 추천은 공개하지 않기로 한 상대 파티를 역산하게 만든다.
 */
export type DeckSuggestion = {
  key: "power" | "mono" | "spread";
  title: string;
  note: string;
  members: RankingPokemon[];
  power: number;
};

const sumPower = (members: RankingPokemon[]) => members.reduce((total, pokemon) => total + pokemon.combatPower, 0);
const byPower = (a: RankingPokemon, b: RankingPokemon) => b.combatPower - a.combatPower;

/** 합산 전투력이 가장 높은 3마리. */
function strongest(owned: RankingPokemon[]): DeckSuggestion | null {
  if (owned.length < 3) return null;
  const members = [...owned].sort(byPower).slice(0, 3);
  return { key: "power", title: "전투력 최대형", note: "합산 전투력이 가장 높은 조합이에요", members, power: sumPower(members) };
}

/** 같은 타입 3마리. 우리 규칙에서 모든 피해가 1.1배가 된다. */
function monoType(owned: RankingPokemon[]): DeckSuggestion | null {
  const groups = new Map<string, RankingPokemon[]>();
  for (const pokemon of owned) groups.set(pokemon.battleType, [...(groups.get(pokemon.battleType) ?? []), pokemon]);
  const best = [...groups.values()]
    .filter((group) => group.length >= 3)
    .map((group) => [...group].sort(byPower).slice(0, 3))
    .sort((a, b) => sumPower(b) - sumPower(a))[0];
  if (!best) return null;
  return {
    key: "mono",
    title: "단일 타입형",
    note: `같은 타입 3마리라 피해가 ${MONO_TYPE_BONUS}배가 돼요`,
    members: best,
    power: sumPower(best),
  };
}

/** 서로 다른 3타입. 한 타입에 몰려 통째로 불리해지는 걸 막는다. */
function spreadType(owned: RankingPokemon[]): DeckSuggestion | null {
  const members: RankingPokemon[] = [];
  const used = new Set<BattleType>();
  for (const pokemon of [...owned].sort(byPower)) {
    if (used.has(pokemon.battleType as BattleType)) continue;
    used.add(pokemon.battleType as BattleType);
    members.push(pokemon);
    if (members.length === 3) break;
  }
  if (members.length < 3) return null;
  return { key: "spread", title: "타입 분산형", note: "서로 다른 세 타입이라 약점이 겹치지 않아요", members, power: sumPower(members) };
}

/**
 * 편집 중인 덱에 맞춰 최대 두 개를 고른다.
 * 방어 덱은 오래 버텨야 하니 전투력을, 공격 덱은 상성 폭을 위로 올린다.
 */
export function deckSuggestions(owned: RankingPokemon[], kind: "attack" | "defense"): DeckSuggestion[] {
  const all = [strongest(owned), monoType(owned), spreadType(owned)].filter((item): item is DeckSuggestion => item !== null);
  const order = kind === "defense" ? ["power", "mono", "spread"] : ["spread", "mono", "power"];
  const unique = new Map<string, DeckSuggestion>();
  for (const suggestion of [...all].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))) {
    const signature = [...suggestion.members].map((pokemon) => pokemon.throwId).sort().join(",");
    if (!unique.has(signature)) unique.set(signature, suggestion);
  }
  return [...unique.values()].slice(0, 2);
}
