import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

let tabs = "";
let page = "";

beforeAll(async () => {
  [tabs, page] = await Promise.all([
    readFile("src/app/admin/OverviewTabs.tsx", "utf8"),
    readFile("src/app/admin/pokedex/page.tsx", "utf8").catch(() => ""),
  ]);
});

describe("어드민 포켓몬 도감 대시보드", () => {
  it("도감 현황과 개발 탭을 나누고 결투 연출은 개발 탭에 둔다", async () => {
    const page = await readFile("src/app/admin/pokedex/page.tsx", "utf8");
    expect(page).toContain('tab === "development"');
    expect(page).toContain("개발");
    expect(page).toContain("<DuelPreview />");
  });

  it("대시보드 탭에서 도감 현황으로 이동할 수 있다", () => {
    expect(tabs).toContain('href: "/admin/pokedex"');
    expect(tabs).toContain('label: "도감"');
  });

  it("포획자·포켓몬 랭킹과 포획 기록을 보여준다", () => {
    expect(page).toContain('from("pokemon_throws")');
    expect(page).toContain("포획 랭킹");
    expect(page).toContain("인기 포켓몬");
    expect(page).toContain("회원별 포획 기록");
    expect(page).toContain("가장 많이 잡은 회원");
    expect(page).toContain("가장 많이 잡힌 포켓몬");
  });

  it("최근 출현과 역대 출현 포켓몬을 보여준다", () => {
    expect(page).toContain('from("pokemon_appearances")');
    expect(page).toContain("최근 출현");
    expect(page).toContain("역대 출현 포켓몬");
  });

  it("회원 테이블 표면으로 포획 기록을 보여준다", () => {
    expect(page).toContain("회원별 포획 기록");
    expect(page).toContain("포획 포켓몬");
    expect(page).toContain('href={`/admin/members/${entry.user_id}`}');
  });
});
