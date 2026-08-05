import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("회원 홈 커뮤니티", () => {
  it("공지 조회와 카드는 유지하고 커뮤니티 조회와 카드는 제외한다", async () => {
    const page = await readFile("src/app/(member)/HomeDashboard.tsx", "utf8");

    expect(page).toContain('from("notices")');
    expect(page).toContain("공지");
    expect(page).not.toContain('from("posts")');
    expect(page).not.toContain("커뮤니티");
  });
});
