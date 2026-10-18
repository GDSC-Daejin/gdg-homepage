import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("회원 홈의 스터디·프로젝트 안내", () => {
  it("소속이 없을 때 목록 준비 중 안내를 보여준다", async () => {
    const page = await readFile("src/app/(member)/HomeDashboard.tsx", "utf8");

    expect(page).toContain('from("group_members")');
    expect(page).toContain("내 스터디·프로젝트");
    expect(page).toContain("아직 참여 중인 활동이 없어요");
    expect(page).toContain("목록 준비 중");
  });
});
