import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

let sql = "";

beforeAll(async () => {
  sql = await readFile("supabase/migrations/0060_pokedex_remaining_balls.sql", "utf8").catch(() => "");
});

describe("도감봇 남은 몬스터볼", () => {
  it("몬스터볼 소진을 하루 횟수 제한보다 먼저 확인하고 잔여 수를 돌려준다", () => {
    expect(sql).toContain("'remaining_balls', v_quantity - 1");
    expect(sql.indexOf("if coalesce(v_quantity, 0) = 0")).toBeLessThan(sql.indexOf("count(*) from pokemon_throws"));
  });
});
