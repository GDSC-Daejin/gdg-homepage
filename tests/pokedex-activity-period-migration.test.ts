import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

let sql = "";
let morningSql = "";

beforeAll(async () => {
  sql = await readFile("supabase/migrations/0073_pokedex_five_daily_appearances.sql", "utf8").catch(() => "");
  morningSql = await readFile("supabase/migrations/0089_pokedex_expand_morning_pool.sql", "utf8").catch(() => "");
});

describe("도감봇 출현 시간대", () => {
  it("하루 다섯 출현과 포켓몬별 낮·밤 활동 시간대를 저장한다", () => {
    expect(sql).toContain("appearance_order between 1 and 5");
    expect(sql).toContain("add column activity_period text not null default 'day'");
    expect(sql).toContain("set activity_period = 'night'");
  });

  it("아침형 풀을 common·uncommon 포켓몬 여섯 종으로 넓힌다", () => {
    expect(morningSql).toContain("where pokedex_no in (13, 14, 29, 30, 32, 33)");
  });
});
