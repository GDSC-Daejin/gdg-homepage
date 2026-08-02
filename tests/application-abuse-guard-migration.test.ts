import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("공개 지원폼 남용 방지 마이그레이션", () => {
  it("동일인 캡 트리거와 IP 스로틀 RPC를 정의한다", async () => {
    const migration = await readFile(
      "supabase/migrations/0035_application_abuse_guard.sql",
      "utf8",
    );

    // 백스톱 인덱스
    expect(migration).toContain("applications_created_at_idx");

    // BEFORE INSERT 트리거 (SECURITY DEFINER)
    expect(migration).toContain("function public.applications_abuse_guard()");
    expect(migration).toContain("security definer set search_path = public");
    expect(migration).toContain("before insert on public.applications");
    expect(migration).toContain("raise exception 'DUPLICATE_APPLICANT'");
    expect(migration).toContain("raise exception 'RATE_LIMITED'");

    // 동일인 캡은 학번/연락처 기준
    expect(migration).toContain("season = new.season and student_no = new.student_no");
    expect(migration).toContain("season = new.season and phone = new.phone");

    // IP 스로틀 테이블 + RPC + grant
    expect(migration).toContain("create table public.submission_throttle");
    expect(migration).toContain("function public.check_submission_rate(p_ip text)");
    expect(migration).toContain(
      "grant execute on function public.check_submission_rate(text) to anon, authenticated",
    );
  });

  it("toKoreanError가 남용 방지 코드를 한국어로 매핑한다", async () => {
    const errors = await readFile("src/lib/errors.ts", "utf8");

    expect(errors).toContain("DUPLICATE_APPLICANT:");
    expect(errors).toContain("RATE_LIMITED:");
  });
});
