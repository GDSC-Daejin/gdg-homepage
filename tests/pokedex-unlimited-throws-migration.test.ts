import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

let sql = "";

beforeAll(async () => {
  sql = await readFile("supabase/migrations/0061_pokedex_unlimited_throws.sql", "utf8").catch(() => "");
});

describe("도감봇 포획 횟수", () => {
  it("하루 포획 횟수 제한 없이 몬스터볼 수량만 확인한다", () => {
    expect(sql).toContain("create or replace function public.pokedex_throw_ball");
    expect(sql).not.toContain("count(*) from pokemon_throws");
    expect(sql).toContain("if coalesce(v_quantity, 0) = 0");
  });
});
