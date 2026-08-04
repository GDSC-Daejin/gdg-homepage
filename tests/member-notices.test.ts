import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("회원 공지 목록", () => {
  it("상세 링크 대신 네이티브 아코디언으로 본문을 표시한다", async () => {
    const page = await readFile("src/app/(member)/notices/page.tsx", "utf8");

    expect(page).toContain("<details");
    expect(page).toContain("<summary");
    expect(page).toContain("{notice.body}");
    expect(page).not.toContain("href={`/notices/${notice.id}`}");
  });

  it("다크 모드에서 공지 카드 배경 토큰을 사용한다", async () => {
    const page = await readFile("src/app/(member)/notices/page.tsx", "utf8");

    expect(page).toContain("dark:bg-gray-100");
  });
});
