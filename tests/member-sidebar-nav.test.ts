import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PokedexTabs } from "@/app/(member)/pokedex/PokedexTabs";

describe("회원 사이드바", () => {
  it("포켓몬과 별도 랭킹전 메뉴를 표시하고 제외·보류한 메뉴는 숨긴다", async () => {
    const nav = await readFile("src/app/(member)/SidebarNav.tsx", "utf8");
    const baseGroups = nav.slice(nav.indexOf("const baseGroups"), nav.indexOf("export function"));

    expect((baseGroups.match(/href:/g) ?? [])).toHaveLength(8);
    for (const label of ["홈", "이벤트", "스케줄", "포켓몬", "랭킹전", "꼬북봇", "문의", "프로필"]) {
      expect(baseGroups).toContain(`label: "${label}"`);
    }
    for (const label of ["공지", "커뮤니티", "자료실", "설문"]) {
      expect(baseGroups).not.toContain(`label: "${label}"`);
    }
    expect(baseGroups).not.toContain('label: "프렌들리숍"');
    expect(baseGroups).not.toContain('href: "/store"');
    expect(baseGroups).not.toContain('href: "/attend"');
    expect(baseGroups).not.toContain('label: "회의록"');
    expect(baseGroups).not.toContain('label: "자유게시판"');
    expect(baseGroups).not.toContain('label: "질문답변"');
  });

  it("프렌들리숍은 포켓몬 탭 줄로 옮기고, /store에서도 포켓몬 메뉴를 활성으로 둔다", async () => {
    const [nav, tabs, pokedex, store] = await Promise.all([
      readFile("src/app/(member)/SidebarNav.tsx", "utf8"),
      readFile("src/app/(member)/pokedex/PokedexTabs.tsx", "utf8"),
      readFile("src/app/(member)/pokedex/page.tsx", "utf8"),
      readFile("src/app/(member)/store/page.tsx", "utf8"),
    ]);

    expect(nav).toContain('matchPrefixes: ["/pokedex", "/store"]');
    expect(tabs).toContain('href: "/store", label: "프렌들리숍"');
    expect(pokedex).toContain("<PokedexTabs");
    expect(store).toContain('<PokedexTabs active="store" />');
    expect(nav).toContain('rawPathname.replace(/^\\/tour(?=\\/|$)/, "")');
  });

});

describe("포켓몬 탭 줄", () => {
  it("프렌들리숍 탭은 /store로 연결하고, 현재 화면만 활성으로 표시한다", () => {
    const store = renderToStaticMarkup(createElement(PokedexTabs, { active: "store" }));
    const collection = renderToStaticMarkup(createElement(PokedexTabs, { active: "collection" }));

    expect(store).toMatch(/href="\/store"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/store"/);
    expect(store.match(/aria-current="page"/g)).toHaveLength(1);
    expect(collection).toContain('href="/store"');
    expect(collection).not.toMatch(/href="\/store"[^>]*aria-current/);
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
