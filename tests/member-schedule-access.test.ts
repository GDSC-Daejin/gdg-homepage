import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("멤버 스케줄 접근", () => {
  it("사이드바에 항상 스케줄 메뉴를 표시한다", async () => {
    const nav = await readFile("src/app/(member)/SidebarNav.tsx", "utf8");

    expect(nav).toContain('href: "/schedule", label: "스케줄", icon: "meetingPoll"');
  });

  it("스케줄은 승인된 멤버가 열고, 생성 버튼은 관리자에게만 보인다", async () => {
    const layout = await readFile("src/app/schedule/layout.tsx", "utf8");

    expect(layout).toContain("requireProfile");
    expect(layout).toContain("MemberShell");
    expect(layout).toContain("canCreate={isStaff(profile)}");
  });

  it("참여한 멤버만 스케줄과 전체 응답을 조회·수정할 수 있다", async () => {
    const migration = await readFile("supabase/migrations/0087_meeting_poll_member_access.sql", "utf8");

    expect(migration).toContain('"meeting_polls: participant read"');
    expect(migration).toContain('"meeting_poll_participants: participant read"');
    expect(migration).toContain('"meeting_poll_participants: self respond"');
    expect(migration).not.toContain("public.is_admin() and user_id = auth.uid()");
  });
});
