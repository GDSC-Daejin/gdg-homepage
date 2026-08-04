import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { BattleType } from "@/lib/pokedex/battle-effects";
import { leadMatchup, typeMultiplier } from "@/lib/pokedex/type-matchup";

const TYPES: BattleType[] = ["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "fairy", "steel"];
const isBattleType = (value: string): value is BattleType => (TYPES as string[]).includes(value);

/** 서버 함수(0078)의 case 절을 그대로 읽어 (공격, 방어) → 배수 표로 만든다. */
async function serverTable() {
  const sql = await readFile("supabase/migrations/0078_pokedex_ranking_league.sql", "utf8");
  const body = sql.slice(sql.indexOf("create function public.pokedex_rank_type_multiplier"));
  const table = new Map<string, number>();
  const skipped: string[] = [];
  // 서버는 `in ('a', 'b')`와 `= 'a'` 두 형태를 섞어 쓴다. 둘 다 읽는다.
  for (const [, attacker, list, single, value] of body.slice(0, body.indexOf("$$;")).matchAll(
    /when p_attacker = '(\w+)' and p_defender (?:in \(([^)]*)\)|= '(\w+)') then ([\d.]+)/g,
  )) {
    for (const raw of (list ?? single).split(",")) {
      const defender = raw.trim().replace(/'/g, "");
      if (!isBattleType(attacker) || !isBattleType(defender)) { skipped.push(`${attacker}->${defender}`); continue; }
      table.set(`${attacker}->${defender}`, Number(value));
    }
  }
  return { table, skipped };
}

describe("타입 상성표", () => {
  it("모든 조합이 서버 pokedex_rank_type_multiplier와 같은 값이다", async () => {
    const { table } = await serverTable();
    const mismatches: string[] = [];
    for (const attacker of TYPES) {
      for (const defender of TYPES) {
        const key = `${attacker}->${defender}`;
        const expected = table.get(key) ?? 1;
        const actual = typeMultiplier(attacker, defender);
        if (actual !== expected) mismatches.push(`${key}: 서버 ${expected} / 화면 ${actual}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("서버 표에서 옮기지 못한 항목은 BattleType에 없는 타입뿐이다", async () => {
    // 서버 표에 dark 항목이 남아 있지만 BattleType에 dark가 없어 실제로는 쓰이지 않는다.
    const { skipped } = await serverTable();
    expect([...new Set(skipped.map((pair) => pair.split("->")[1]))]).toEqual(["dark"]);
    expect(skipped.sort()).toEqual(["bug->dark", "fairy->dark", "fighting->dark", "ghost->dark"]);
  });

  it("선봉 상성은 공개된 선봉 한 마리끼리만 본다", () => {
    expect(leadMatchup("water", "fire")).toEqual({ verdict: "유리", tone: "positive", multiplier: 1.2 });
    expect(leadMatchup("fire", "water")).toEqual({ verdict: "불리", tone: "negative", multiplier: 0.8 });
    expect(leadMatchup("normal", "normal")).toEqual({ verdict: "호각", tone: "neutral", multiplier: 1 });
  });

  it("선봉이 비어 있으면 판정하지 않는다", () => {
    expect(leadMatchup(undefined, "fire")).toBeNull();
    expect(leadMatchup("water", undefined)).toBeNull();
  });
});
