import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("출석 코드 시도 제한 마이그레이션", () => {
  it("5회 실패 후 10분간 차단하고 성공하면 시도 기록을 지운다", async () => {
    const migration = await readFile(
      "supabase/migrations/0036_attendance_attempt_limit.sql",
      "utf8",
    );

    expect(migration).toContain("create table public.attendance_attempts");
    expect(migration).toContain("primary key (event_id, user_id)");
    expect(migration).toContain("v_attempts >= 5");
    expect(migration).toContain("interval '10 minutes'");
    expect(migration).toContain("raise exception 'TOO_MANY_ATTEMPTS'");
    expect(migration).toContain("delete from public.attendance_attempts");
    expect(migration).toContain("attempts = public.attendance_attempts.attempts + 1");
  });

  it("6자 대문자 영숫자 출석 코드를 발급한다", async () => {
    const migration = await readFile(
      "supabase/migrations/0036_attendance_attempt_limit.sql",
      "utf8",
    );

    expect(migration).toContain("create extension if not exists pgcrypto");
    expect(migration).toContain("gen_random_bytes(6)");
    expect(migration).toContain("upper(substr(");
  });
});
