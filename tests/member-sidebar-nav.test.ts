import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("회원 사이드바", () => {
  it("8개 메뉴와 커뮤니티 통합 항목을 표시한다", async () => {
    const nav = await readFile("src/app/(member)/SidebarNav.tsx", "utf8");
    const baseGroups = nav.slice(nav.indexOf("const baseGroups"), nav.indexOf("export function"));

    expect((baseGroups.match(/href:/g) ?? [])).toHaveLength(8);
    for (const label of ["홈", "이벤트", "공지", "커뮤니티", "설문", "문의", "자료실", "프로필"]) {
      expect(baseGroups).toContain(`label: "${label}"`);
    }
    expect(baseGroups).not.toContain('href: "/attend"');
    expect(baseGroups).not.toContain('label: "회의록"');
    expect(baseGroups).not.toContain('label: "자유게시판"');
    expect(baseGroups).not.toContain('label: "질문답변"');
  });

  it("커뮤니티를 세 경로에서 활성화한다", async () => {
    const nav = await readFile("src/app/(member)/SidebarNav.tsx", "utf8");

    expect(nav).toContain('matchPrefixes: ["/board", "/qna", "/meetings"]');
    expect(nav).toContain("item.matchPrefixes?.some((prefix) => pathname.startsWith(prefix))");
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
