import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("회원 사이드바", () => {
  it("일반 멤버에게 이벤트 탭을 표시한다", async () => {
    const nav = await readFile("src/app/(member)/SidebarNav.tsx", "utf8");
    const activity = nav.slice(nav.indexOf('title: "활동"'), nav.indexOf('title: "자료"'));

    expect(activity).toContain('href: "/events", label: "이벤트"');
  });

  it("출석 이력을 계정 그룹에 둔다", async () => {
    const nav = await readFile("src/app/(member)/SidebarNav.tsx", "utf8");
    const activity = nav.slice(nav.indexOf('title: "활동"'), nav.indexOf('title: "자료"'));
    const account = nav.slice(nav.indexOf('title: "계정"'));

    expect(activity).not.toContain('href: "/attend"');
    expect(account).toContain('href: "/attend"');
  });
});
