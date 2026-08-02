import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

let sql = "";
let dailyRoute = "";

beforeAll(async () => {
  [sql, dailyRoute] = await Promise.all([
    readFile("supabase/migrations/0072_pokedex_daily_ball_refill.sql", "utf8").catch(() => ""),
    readFile("src/app/api/cron/pokedex-daily/route.ts", "utf8"),
  ]);
});

describe("도감봇 몬스터볼 리필", () => {
  it("매일 지급 시 보유 몬스터볼을 세 개로 채우고, 출현 예약과 분리한다", () => {
    expect(sql).toContain("set quantity = 3");
    expect(dailyRoute).not.toContain('rpc("pokedex_grant_daily_balls")');
  });
});
