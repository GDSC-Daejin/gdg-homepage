import { describe, expect, it } from "vitest";
import { deckSuggestions } from "@/lib/pokedex/deck-suggestions";
import type { RankingPokemon } from "@/lib/pokedex/ranking-league";

function pokemon(name: string, combatPower: number, battleType: string): RankingPokemon {
  return { throwId: name, pokemonId: name, name, imagePath: `/${name}.png`, combatPower, battleType, rarity: "common" };
}

const OWNED: RankingPokemon[] = [
  pokemon("가디", 532, "fire"),
  pokemon("이브이", 519, "normal"),
  pokemon("피카츄", 508, "electric"),
  pokemon("꼬마돌", 486, "rock"),
  pokemon("꼬부기", 451, "water"),
  pokemon("뚜벅쵸", 427, "grass"),
];

const titles = (list: ReturnType<typeof deckSuggestions>) => list.map((item) => item.title);

describe("덱 추천", () => {
  it("전투력 최대형은 합산이 가장 높은 3마리를 고른다", () => {
    const power = deckSuggestions(OWNED, "defense").find((item) => item.key === "power");
    expect(power?.members.map((item) => item.name)).toEqual(["가디", "이브이", "피카츄"]);
    expect(power?.power).toBe(532 + 519 + 508);
  });

  it("타입 분산형은 서로 다른 세 타입을 고른다", () => {
    const spread = deckSuggestions(OWNED, "attack").find((item) => item.key === "spread");
    expect(new Set(spread?.members.map((item) => item.battleType)).size).toBe(3);
  });

  it("같은 타입 3마리가 없으면 단일 타입형을 추천하지 않는다", () => {
    expect(titles(deckSuggestions(OWNED, "attack"))).not.toContain("단일 타입형");
  });

  it("같은 타입 3마리가 있으면 단일 타입형을 추천한다", () => {
    const monoOwned = [...OWNED, pokemon("식스테일", 524, "fire"), pokemon("부스터", 540, "fire")];
    const mono = deckSuggestions(monoOwned, "attack").find((item) => item.key === "mono");
    expect(mono?.members.map((item) => item.battleType)).toEqual(["fire", "fire", "fire"]);
    expect(mono?.members.map((item) => item.name)).toEqual(["부스터", "가디", "식스테일"]);
  });

  it("편집 중인 덱에 따라 순서가 달라진다", () => {
    expect(titles(deckSuggestions(OWNED, "defense"))[0]).toBe("전투력 최대형");
    expect(titles(deckSuggestions(OWNED, "attack"))[0]).toBe("타입 분산형");
  });

  it("같은 구성이 두 번 나오지 않고 최대 두 개만 준다", () => {
    const list = deckSuggestions(OWNED, "attack");
    expect(list.length).toBeLessThanOrEqual(2);
    const signatures = list.map((item) => item.members.map((member) => member.throwId).sort().join(","));
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("보유 포켓몬이 3마리 미만이면 추천하지 않는다", () => {
    expect(deckSuggestions(OWNED.slice(0, 2), "attack")).toEqual([]);
  });
});
