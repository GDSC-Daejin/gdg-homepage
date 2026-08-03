import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("도감 전투력", () => {
  it("종별 전투력 범위와 출현 전투력을 DB에서 생성한다", async () => {
    const sql = await readFile("supabase/migrations/0070_pokedex_combat_power.sql", "utf8");

    expect(sql).toContain("add column cp_min int not null");
    expect(sql).toContain("add column cp_max int not null");
    expect(sql).toContain("add column combat_power int");
    expect(sql).toContain("create trigger pokemon_appearances_set_combat_power");
    expect(sql).toContain("floor(random() * (v_max - v_min + 1))::int + v_min");
  });

  it("포획자 조회에 출현 전투력을 포함한다", async () => {
    const sql = await readFile("supabase/migrations/0070_pokedex_combat_power.sql", "utf8");

    expect(sql).toContain("combat_power int");
    expect(sql).toContain("join pokemon_appearances a on a.id = t.appearance_id");
    expect(sql).toContain("order by a.combat_power desc nulls last");
  });

  it("기존 출현 기록에도 전투력을 한 번 채운다", async () => {
    const sql = await readFile("supabase/migrations/0071_pokedex_combat_power_backfill.sql", "utf8");

    expect(sql).toContain("a.combat_power is null");
    expect(sql).toContain("floor(random() * (p.cp_max - p.cp_min + 1))::int + p.cp_min");
  });

  it("포획자는 만료된 출현의 전투력도 다시 읽을 수 있다", async () => {
    const sql = await readFile("supabase/migrations/0079_pokedex_owned_appearance_read.sql", "utf8").catch(() => "");

    expect(sql).toContain('drop policy "pokemon_appearances: posted read" on public.pokemon_appearances');
    expect(sql).toContain("t.appearance_id = pokemon_appearances.id");
    expect(sql).toContain("t.user_id = auth.uid()");
  });
});
