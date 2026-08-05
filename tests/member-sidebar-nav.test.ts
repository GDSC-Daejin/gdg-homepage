import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("회원 사이드바", () => {
  it("7개 메뉴만 표시하고 보류한 메뉴는 숨긴다", async () => {
    const nav = await readFile("src/app/(member)/SidebarNav.tsx", "utf8");
    const baseGroups = nav.slice(nav.indexOf("const baseGroups"), nav.indexOf("export function"));

    expect((baseGroups.match(/href:/g) ?? [])).toHaveLength(7);
    for (const label of ["홈", "이벤트", "스케줄", "설문", "문의", "포켓몬 도감", "프로필"]) {
      expect(baseGroups).toContain(`label: "${label}"`);
    }
    for (const label of ["공지", "커뮤니티", "자료실"]) {
      expect(baseGroups).not.toContain(`label: "${label}"`);
    }
    expect(baseGroups).not.toContain('href: "/attend"');
    expect(baseGroups).not.toContain('label: "회의록"');
    expect(baseGroups).not.toContain('label: "자유게시판"');
    expect(baseGroups).not.toContain('label: "질문답변"');
  });

});

describe("커뮤니티 탭", () => {
  it("게시판, 질문답변, 회의록을 경로 기반 링크로 렌더한다", async () => {
    const tabs = await readFile("src/components/board/CommunityTabs.tsx", "utf8").catch(() => "");

    expect(tabs).toContain('"use client"');
    expect(tabs).toContain('usePathname');
    expect(tabs).toContain('href: "/board", label: "자유게시판"');
    expect(tabs).toContain('href: "/qna", label: "질문답변"');
    expect(tabs).toContain('href: "/meetings", label: "회의록"');
    expect(tabs).toContain("pathname.startsWith(tab.href)");
  });
});
