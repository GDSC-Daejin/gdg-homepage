import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

let sql = "";

beforeAll(async () => {
  sql = await readFile("supabase/migrations/0059_pokedex_three_daily_throws.sql", "utf8").catch(() => "");
});

describe("도감봇 하루 포획 횟수", () => {
  it("하루 한 번 고유 제약을 제거하고 세 번까지 허용한다", () => {
    expect(sql).toContain("drop constraint pokemon_throws_user_id_attempted_on_key");
    expect(sql).toContain("count(*) from pokemon_throws where user_id = v_user and attempted_on = v_today) >= 3");
  });
});
