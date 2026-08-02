import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("도감 랭킹전", () => {
  it("시즌·프리셋·일일 상대·원자 전투를 데이터베이스에서 관리한다", async () => {
    const sql = await readFile("supabase/migrations/0078_pokedex_ranking_league.sql", "utf8").catch(() => "");

    for (const table of ["pokemon_rank_seasons", "pokemon_rank_entries", "pokemon_rank_presets", "pokemon_rank_allocations", "pokemon_rank_battles", "pokemon_rank_rewards"]) {
      expect(sql).toContain(`create table public.${table}`);
    }
    expect(sql).toContain("create function public.pokedex_rank_start_battle");
    expect(sql).toContain("create function public.pokedex_rank_refresh_daily");
    expect(sql).toContain("unique (allocation_id)");
    expect(sql).toContain("for update");
    expect(sql).toContain("v_damage := floor((200 + v_attacker_cp * 0.4)");
    expect(sql).toContain("v_attacker_delta := 30");
    expect(sql).toContain("v_attacker_delta := -30");
  });

  it("덱 중복·전설 제한과 당사자 전용 전투 기록을 검증한다", async () => {
    const sql = await readFile("supabase/migrations/0078_pokedex_ranking_league.sql", "utf8").catch(() => "");

    expect(sql).toContain("count(distinct t.pokemon_id)");
    expect(sql).toContain("count(distinct m.pokemon_id)");
    expect(sql).toContain("p.rarity = 'legendary'");
    expect(sql).toContain("if b.attacker_id <> v_user and b.defender_id <> v_user then raise exception 'FORBIDDEN'; end if;");
  });
});
