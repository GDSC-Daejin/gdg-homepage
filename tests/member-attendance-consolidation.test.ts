import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("멤버 출석 이력 통합", () => {
  it("프로필에서 이벤트 상세 출석 이력을 최근순으로 조회한다", async () => {
    const profile = await readFile("src/app/(member)/profile/page.tsx", "utf8");

    expect(profile).toContain(
      '.select("event_id, checked_at, event:events(id, title, type, starts_at)")',
    );
    expect(profile).toContain('.order("checked_at", { ascending: false })');
    expect(profile).toContain("출석 이력");
    expect(profile).toContain("아직 참석한 활동이 없어요");
  });

  it("기존 출석 이력 경로는 프로필로 리디렉트한다", async () => {
    const attend = await readFile("src/app/(member)/attend/page.tsx", "utf8");

    expect(attend).toContain('import { redirect } from "next/navigation"');
    expect(attend).toContain('redirect("/profile")');
  });
});
