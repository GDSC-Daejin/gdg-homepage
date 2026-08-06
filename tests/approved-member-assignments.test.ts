import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("승인된 회원만 배정", () => {
  it("회원 선택 목록과 서버 RPC 모두 승인 상태를 확인한다", async () => {
    const [schedule, group, points, dashboard, pokedex, sql] = await Promise.all([
      readFile("src/actions/meeting-poll.ts", "utf8"),
      readFile("src/app/admin/groups/[id]/page.tsx", "utf8"),
      readFile("src/app/admin/points/page.tsx", "utf8"),
      readFile("src/app/admin/page.tsx", "utf8"),
      readFile("src/app/admin/pokedex/page.tsx", "utf8"),
      readFile("supabase/migrations/0093_approved_member_assignments.sql", "utf8"),
    ]);

    expect(schedule).toContain('.not("approved_at", "is", null)');
    expect(group).toContain('member.status === "active" && member.approved_at');
    expect(points).toContain('.not("approved_at", "is", null)');
    expect(dashboard).toContain('topUsers.filter(([id]) => topProfileById.has(id))');
    expect(pokedex).toContain('catches = catches.filter((entry) => approvedIds.has(entry.user_id))');
    expect(sql).toContain('approved_at is not null');
  });
});
