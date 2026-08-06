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

  it("승인 대기 회원은 제외한다", async () => {
    const [page, reads] = await Promise.all([
      readFile("src/app/admin/attendance/page.tsx", "utf8"),
      readFile("src/lib/community/supabase.ts", "utf8"),
    ]);

    expect(page).toContain('.not("approved_at", "is", null)');
    expect(reads).toContain('.not("approved_at", "is", null)');
  });

  it("회원 테이블과 같은 행·아바타·상세 링크 표면을 사용한다", async () => {
    const page = await readFile("src/app/admin/attendance/page.tsx", "utf8");

    expect(page).toContain("회원별 출석 현황");
    expect(page).toContain("overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card");
    expect(page).toContain("hover:bg-gray-50");
    expect(page).toContain('<Avatar');
    expect(page).toContain('href={`/admin/members/${row.member.id}`}');
  });
});
