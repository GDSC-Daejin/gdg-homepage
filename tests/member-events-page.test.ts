import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("회원 이벤트 목록", () => {
  it("멤버 레이아웃 안에서 관리자와 같은 이벤트 카드를 표시한다", async () => {
    const memberPagePath = "src/app/(member)/events/page.tsx";

    expect(existsSync(memberPagePath)).toBe(true);
    if (!existsSync(memberPagePath)) return;

    const page = await readFile(memberPagePath, "utf8");
    expect(page).toContain('basePath="/events"');
    expect(page).toContain('hrefBase="/events"');
    expect(page).not.toContain("/admin/events");
    expect(existsSync("src/app/events/page.tsx")).toBe(false);
  });
});
