import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("랭킹전 공격 시작 RPC", () => {
  it("기존 전투 재조회 뒤의 FOUND가 아니라 배정 행 자체로 존재를 확인한다", async () => {
    const sql = await readFile("supabase/migrations/0124_pokedex_ranking_start_battle_found.sql", "utf8");

    expect(sql).toContain("create or replace function public.pokedex_rank_start_battle(p_allocation uuid, p_attack_slot smallint)");
    expect(sql).toContain("if a.id is null or a.season_id <> v_season");
    expect(sql).not.toContain("if not found or a.season_id");
    // 배정 잠금 → 기존 전투 재조회 순서는 유지한다(동시 요청 시 같은 전투를 돌려준다).
    expect(sql.indexOf("select * into a from pokemon_rank_allocations where id = p_allocation for update;")).toBeLessThan(sql.indexOf("if a.id is null"));
  });
});
