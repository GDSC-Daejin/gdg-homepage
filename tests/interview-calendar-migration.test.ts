import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("면접 Calendar 마이그레이션", () => {
  it("재동기화용 Calendar 이벤트 ID를 보관한다", async () => {
    const migration = await readFile(
      "supabase/migrations/0100_interview_calendar_events.sql",
      "utf8",
    );

    expect(migration).toContain("add column calendar_event_id text");
  });
});
