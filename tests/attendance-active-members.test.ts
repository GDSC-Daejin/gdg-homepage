import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const memberRoles = '.in("role", ["member", "organizer", "team_member"])';

describe("출석 활동 회원 조회", () => {
  it("일반 회원과 운영진 역할을 모두 포함한다", async () => {
    const [page, reads] = await Promise.all([
      readFile("src/app/admin/attendance/page.tsx", "utf8"),
      readFile("src/lib/community/supabase.ts", "utf8"),
    ]);

    expect(page).toContain(memberRoles);
    expect(reads).toContain(memberRoles);
  });
});
