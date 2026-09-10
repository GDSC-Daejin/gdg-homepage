import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("면접 취소·변경·노쇼 관리 마이그레이션", () => {
  it("지원서 노쇼 상태와 변경 횟수를 추가한다", async () => {
    const migration = await readFile(
      "supabase/migrations/0114_interview_booking_management.sql",
      "utf8",
    );

    expect(migration).toContain("'no_show'");
    expect(migration).toContain("interview_change_count int not null default 0");
  });

  it("예약 이력과 지원자용 시간 제한 RPC를 정의한다", async () => {
    const migration = await readFile(
      "supabase/migrations/0114_interview_booking_management.sql",
      "utf8",
    );

    expect(migration).toContain("create table public.interview_booking_events");
    expect(migration).toContain("create or replace function public.cancel_interview_booking");
    expect(migration).toContain("create or replace function public.reschedule_interview_booking");
    expect(migration).toContain("interval '24 hours'");
    expect(migration).toContain("'CHANGE_LIMIT'");
  });

  it("운영진 노쇼 처리 시 지원서 상태도 no_show로 바꾼다", async () => {
    const migration = await readFile(
      "supabase/migrations/0114_interview_booking_management.sql",
      "utf8",
    );

    expect(migration).toContain("admin_mark_interview_outcome");
    expect(migration).toContain("set status = 'no_show'");
    expect(migration).toContain("action, actor_type, actor_id");
  });
});
