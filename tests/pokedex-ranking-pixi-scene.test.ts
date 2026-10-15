import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("랭킹전 PixiJS 전투장", () => {
  it("전투 모달에서만 PixiJS를 동적으로 불러오고, 실패하면 React 로그로 돌아간다", async () => {
    const [scene, animation] = await Promise.all([
      readFile("src/app/(member)/pokedex/PixiRankingBattleScene.tsx", "utf8"),
      readFile("src/app/(member)/pokedex/RankingBattleAnimation.tsx", "utf8"),
    ]);

    expect(scene).toContain('await import("pixi.js")');
    expect(scene).toContain("onUnavailable");
    expect(animation).toContain("sceneAvailable");
    expect(animation).toContain("prefers-reduced-motion: reduce");
  });
});
