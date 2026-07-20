import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("회원 홈의 스터디·프로젝트 안내", () => {
  it("소속이 없을 때 모집 현황 CTA를 보여준다", async () => {
    const page = await readFile("src/app/(member)/HomeDashboard.tsx", "utf8");

    expect(page).toContain('from("group_members")');
    expect(page).toContain("내 스터디·프로젝트");
    expect(page).toContain("모집 중인 스터디·프로젝트 보기");
  });
});
