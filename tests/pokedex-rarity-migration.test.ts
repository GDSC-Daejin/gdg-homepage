import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("도감 희귀도 데이터", () => {
  it("151종에 희귀도, 출현 가중치, 포획률을 저장한다", async () => {
    const sql = await readFile("supabase/migrations/0069_pokedex_rarity.sql", "utf8");

    expect(sql).toContain("add column rarity text not null");
    expect(sql).toContain("add column spawn_weight int not null");
    expect(sql).toContain("when 147 then 'uncommon'");
    expect(sql).toContain("when 149 then 'very_rare'");
    expect(sql).toContain("when 150 then 'legendary'");
    expect(sql).toContain("when 'legendary' then 0.28");
  });
});
