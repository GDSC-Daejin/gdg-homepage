import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { RANKING_TABS, activeRankingTab } from "@/app/(member)/pokedex/ranking/RankingChrome";

describe("랭킹전 내비게이션", () => {
  it("4페이지를 시안 순서대로 둔다", () => {
    expect(RANKING_TABS.map((tab) => tab.label)).toEqual(["랭킹전 홈", "공격", "내 덱", "기록"]);
    expect(RANKING_TABS.map((tab) => tab.href)).toEqual([
      "/pokedex/ranking",
      "/pokedex/ranking/attack",
      "/pokedex/ranking/deck",
      "/pokedex/ranking/log",
    ]);
  });

  it("홈이 하위 페이지를 삼키지 않는다", () => {
    expect(activeRankingTab("/pokedex/ranking")).toBe("/pokedex/ranking");
    expect(activeRankingTab("/pokedex/ranking/attack")).toBe("/pokedex/ranking/attack");
    expect(activeRankingTab("/pokedex/ranking/deck")).toBe("/pokedex/ranking/deck");
    expect(activeRankingTab("/pokedex/ranking/log")).toBe("/pokedex/ranking/log");
  });

  it("랭킹전 밖에서는 아무 탭도 켜지 않는다", () => {
    expect(activeRankingTab("/pokedex")).toBeUndefined();
    expect(activeRankingTab("/pokedex?tab=ranking")).toBeUndefined();
  });

  it("오픈 전에는 도감 탭의 사전 안내로 돌려보낸다", async () => {
    const layout = await readFile("src/app/(member)/pokedex/ranking/layout.tsx", "utf8");
    expect(layout).toContain("if (!RANKING_LEAGUE_OPEN) redirect(\"/pokedex?tab=ranking\")");
  });

  it("랭킹전 화면은 라이트·다크 두 벌의 토큰을 갖는다", async () => {
    const css = await readFile("src/app/(member)/pokedex/ranking/ranking.css", "utf8");
    expect(css).toContain(".dark .rk {");
    // WDS는 라이트 전용이라 랭킹전 화면에서 직접 쓰지 않는다.
    expect(css).not.toContain("--wds-");
    for (const token of ["--rk-bg", "--rk-card", "--rk-text", "--rk-hero", "--rk-primary"]) {
      expect(css.split(".dark .rk {")[1]).toContain(token);
    }
  });
});
