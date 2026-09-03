import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("꼬북봇 지난 시즌", () => {
  it("마감된 시즌과 상위 기여자만 회원에게 반환한다", async () => {
    const sql = await readFile("supabase/migrations/0113_squirtle_season_history.sql", "utf8");

    expect(sql).toContain("where s.status = 'closed'");
    expect(sql).toContain("limit 3");
    expect(sql).toContain("p.role <> 'applicant'");
    expect(sql).toContain("grant execute on function public.squirtle_season_history() to authenticated");
  });
});
