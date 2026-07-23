import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

let sql = "";
let route = "";

beforeAll(async () => {
  [sql, route] = await Promise.all([
    readFile("supabase/migrations/0046_bots.sql", "utf8"),
    readFile("src/app/api/cron/squirtle-daily/route.ts", "utf8"),
  ]);
});

describe("봇 on/off 스위치판", () => {
  it("slug를 기본키로 두어 봇마다 독립적으로 켜고 끈다", () => {
    expect(sql).toContain("create table public.bots");
    expect(sql).toMatch(/slug\s+text\s+primary key/);
    expect(sql).toMatch(/active\s+boolean\s+not null\s+default true/);
  });

  it("꼬북봇을 시드로 넣는다", () => {
    expect(sql).toContain("insert into public.bots");
    expect(sql).toContain("'squirtle'");
  });

  it("RLS를 켜고 어드민 읽기 정책을 둔다", () => {
    expect(sql).toContain("alter table public.bots enable row level security");
    expect(sql).toContain("public.is_admin()");
  });
});

describe("크론 라우트의 비활성 처리", () => {
  it("자기 slug의 active를 확인한다", () => {
    expect(route).toContain('.from("bots")');
    expect(route).toContain('.eq("slug", "squirtle")');
  });

  it("꺼져 있으면 disabled 사유로 조기 반환한다", () => {
    expect(route).toContain('reason: "disabled"');
  });

  it("시즌 마감보다 먼저 확인한다 (꺼진 봇이 보너스를 지급하면 안 된다)", () => {
    const botCheck = route.indexOf('.from("bots")');
    const closeSeason = route.indexOf("squirtle_close_season");

    expect(botCheck).toBeGreaterThan(-1);
    expect(closeSeason).toBeGreaterThan(-1);
    expect(botCheck).toBeLessThan(closeSeason);
  });
});
