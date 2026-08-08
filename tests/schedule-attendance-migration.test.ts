import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migration = "supabase/migrations/0103_schedule_attendance_places_and_survey_audience.sql";

describe("참석 조사와 설문 대상 마이그레이션", () => {
  it("일정 응답 방식·장소·설문 대상을 보관하고 대상별 응답을 제한한다", async () => {
    const sql = await readFile(migration, "utf8");
    expect(sql).toContain("add column response_mode text not null default 'availability'");
    expect(sql).toContain("add column place_id uuid references public.places");
    expect(sql).toContain("add column audience text not null default 'all'");
    expect(sql).toContain("can_answer_survey");
  });
});
