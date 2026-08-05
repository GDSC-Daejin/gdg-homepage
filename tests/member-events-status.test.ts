import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("회원 이벤트 목록 상태", () => {
  it("지난 일정 탭에서 종료 이벤트만 분류한다", async () => {
    const page = await readFile("src/app/(member)/events/page.tsx", "utf8");

    expect(page).toContain("EventStatusToggle");
    expect(page).toContain("isEventPast");
  });
});
