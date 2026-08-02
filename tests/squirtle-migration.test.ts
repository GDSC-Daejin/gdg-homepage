import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

let sql = "";

beforeAll(async () => {
  sql = await readFile("supabase/migrations/0044_squirtle.sql", "utf8");
});

describe("꼬북봇 마이그레이션", () => {
  it("인증 중복을 막는 유니크 제약이 있다", () => {
    expect(sql).toContain("unique (season_id, user_id, checked_on)");
  });

  it("하루 두 번 게시를 막는 제약이 있다", () => {
    expect(sql).toMatch(/posted_on\s+date\s+not null\s+unique/);
  });

  it("활성 시즌은 하나뿐이다", () => {
    expect(sql).toContain("squirtle_one_active_season");
    expect(sql).toContain("where status = 'active'");
  });

  it("날짜를 KST로 계산한다", () => {
    expect(sql).toContain("now() at time zone 'Asia/Seoul'");
  });

  it("UTC 기준 current_date를 쓰지 않는다", () => {
    const withoutKst = sql.replace(/\(now\(\) at time zone 'Asia\/Seoul'\)::date/g, "");
    expect(withoutKst).not.toContain("current_date");
  });

  it("RPC 3개가 authenticated 포함 전 롤에서 revoke된다", () => {
    for (const fn of ["squirtle_checkin", "squirtle_open_season", "squirtle_close_season"]) {
      const pattern = new RegExp(
        `revoke execute on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated`,
      );
      expect(sql).toMatch(pattern);
    }
  });

  it("기존 admin_grant_points를 재정의하지 않는다", () => {
    expect(sql).not.toContain("admin_grant_points");
  });

  it("네 테이블 모두 RLS를 켠다", () => {
    for (const t of ["squirtle_config", "squirtle_seasons", "squirtle_posts", "squirtle_checkins"]) {
      expect(sql).toContain(`alter table public.${t} enable row level security`);
    }
  });
});

describe("꼬북봇 진화 사이클 마이그레이션", () => {
  let cycleSql = "";

  beforeAll(async () => {
    cycleSql = await readFile("supabase/migrations/0053_squirtle_evolution_cycle.sql", "utf8");
  });

  it("ends_on의 not null을 푼다", () => {
    expect(cycleSql).toMatch(/alter column ends_on drop not null/);
  });

  it("시즌 개시가 종료일을 계산하지 않는다", () => {
    expect(cycleSql).toContain("create or replace function public.squirtle_open_season()");
    expect(cycleSql).not.toContain("date_trunc");
  });

  it("시즌 개시 폴백이 활성 시즌만 인정한다", () => {
    expect(cycleSql).toContain("where starts_on = v_today and status = 'active'");
  });

  it("거북왕에 도달한 시즌만 닫는다", () => {
    expect(cycleSql).toContain("where status = 'active' and stage >= 3");
    expect(cycleSql).not.toContain("ends_on <");
  });

  it("날짜를 KST로 계산한다", () => {
    expect(cycleSql).toContain("now() at time zone 'Asia/Seoul'");
    expect(cycleSql).not.toContain("current_date");
  });

  it("재정의한 두 RPC를 다시 봉인한다", () => {
    for (const fn of ["squirtle_open_season", "squirtle_close_season"]) {
      expect(cycleSql).toMatch(
        new RegExp(`revoke execute on function public\\.${fn}\\(\\) from public, anon, authenticated`),
      );
    }
  });

  it("인증 함수는 재정의하지 않는다", () => {
    expect(cycleSql).not.toContain("create or replace function public.squirtle_checkin");
  });
});
