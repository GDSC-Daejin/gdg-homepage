import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFile(`src/app/(member)/pokedex/ranking/${path}`, "utf8").catch(() => "");

describe("랭킹전 4화면", () => {
  it("공격 화면은 공개된 선봉끼리만 상성을 판정한다", async () => {
    const screen = await read("AttackScreen.tsx");
    expect(screen).toContain("leadMatchup(");
    expect(screen).toContain("opponent.lead.battleType");
    expect(screen).toContain("나머지 두 마리는 공개되지 않아요");
    // 상대 파티 전체를 판정에 넣지 않는다.
    expect(screen).not.toContain("defenderTeam");
  });

  it("공격 화면에 상대 방어 승률을 노출하지 않는다", async () => {
    const screen = await read("AttackScreen.tsx");
    expect(screen).not.toContain("방어 승률");
  });

  it("추천 조합은 오늘의 상대를 참고하지 않는다", async () => {
    const [screen, suggestions] = await Promise.all([read("DeckScreen.tsx"), readFile("src/lib/pokedex/deck-suggestions.ts", "utf8")]);
    expect(screen).toContain("deckSuggestions(state.ownedPokemon, editing)");
    // 추천 로직은 보유 포켓몬만 받는다 — 상대가 인자로 들어갈 자리가 없다.
    expect(suggestions).toContain("export function deckSuggestions(owned: RankingPokemon[], kind: \"attack\" | \"defense\")");
    expect(suggestions).not.toContain("opponent");
  });

  it("내 덱에서 공격·방어 모두 마이 파티를 지정할 수 있다", async () => {
    const screen = await read("DeckScreen.tsx");
    expect(screen).toContain("activateRankingAttack");
    expect(screen).toContain("activateRankingDefense");
    expect(screen).toContain("마이 파티로 지정");
  });

  it("홈과 공격 화면의 마이 파티는 활성 공격 프리셋을 따른다", async () => {
    for (const file of ["HomeScreen.tsx", "AttackScreen.tsx"]) {
      expect(await read(file)).toContain("entry.activeAttackSlot ?? 1");
    }
  });

  it("기록 화면은 공격·방어를 나눠 보여주고 걸러낼 수 있다", async () => {
    const screen = await read("LogScreen.tsx");
    expect(screen).toContain("item.role === \"attacker\"");
    expect(screen).toContain("filter === \"all\" || item.role === filter");
    expect(screen).toContain("battleDelta(item)");
  });

  it("전투 연출은 공격·기록 두 화면에서 같은 컴포넌트를 쓴다", async () => {
    for (const file of ["AttackScreen.tsx", "LogScreen.tsx"]) {
      expect(await read(file)).toContain('import { RankingBattleAnimation } from "../RankingBattleAnimation"');
    }
  });

  it("네 화면 어디에도 티어·등급이 없다", async () => {
    for (const file of ["HomeScreen.tsx", "AttackScreen.tsx", "DeckScreen.tsx", "LogScreen.tsx"]) {
      const screen = await read(file);
      for (const tier of ["브론즈", "실버", "골드", "마스터"]) expect(screen).not.toContain(tier);
    }
  });
});
