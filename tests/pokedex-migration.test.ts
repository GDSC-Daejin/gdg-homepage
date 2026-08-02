import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

let sql = "";

beforeAll(async () => {
  sql = await readFile("supabase/migrations/0057_pokedex.sql", "utf8").catch(() => "");
});

describe("도감 마이그레이션", () => {
  it("볼·출현·포획 원장을 두고 하루 한 번 던지기를 DB에서 막는다", () => {
    for (const table of ["pokemon_catalog", "pokemon_ball_inventory", "pokemon_appearances", "pokemon_throws"]) {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(sql).toContain("unique (user_id, attempted_on)");
  });

  it("포획 RPC와 일일 볼 지급 RPC를 외부에서 실행할 수 없게 한다", () => {
    expect(sql).toContain("create or replace function public.pokedex_throw_ball");
    expect(sql).toContain("create or replace function public.pokedex_grant_daily_balls");
    expect(sql).toContain("revoke execute on function public.pokedex_throw_ball(text, text) from public, anon, authenticated");
    expect(sql).toContain("revoke execute on function public.pokedex_grant_daily_balls() from public, anon, authenticated");
  });
});
