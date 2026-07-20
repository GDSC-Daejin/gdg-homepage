import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("회원 이벤트 신청자 목록", () => {
  it("회원에게 신청자 이름과 상태만 보여준다", async () => {
    const [page, migration] = await Promise.all([
      readFile("src/app/(member)/events/[id]/page.tsx", "utf8"),
      readFile("supabase/migrations/0033_member_event_registrants.sql", "utf8"),
    ]);

    expect(page).toContain('rpc("event_registrants"');
    expect(page).toContain("신청한 멤버");
    expect(migration).toContain("function public.event_registrants(p_event_id uuid)");
    expect(migration).toContain("role <> 'applicant'");
    expect(migration).toContain("to authenticated");
  });
});
