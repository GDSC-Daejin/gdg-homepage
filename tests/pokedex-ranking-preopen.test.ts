import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("랭킹전 프리오픈", () => {
  it("멤버 화면에서 프리뷰 UI를 보여주되 정식 랭킹전은 열지 않는다", async () => {
    const [open, page] = await Promise.all([
      readFile("src/lib/pokedex/ranking-open.ts", "utf8"),
      readFile("src/app/(member)/pokedex/page.tsx", "utf8"),
    ]);

    expect(open).toContain("RANKING_LEAGUE_PREOPEN = true");
    expect(page).toContain("RankingPreview");
    expect(page).toContain('import "../../wds.css"');
    expect(page).toContain("RANKING_LEAGUE_PREOPEN && !RANKING_LEAGUE_OPEN");
    expect(page).toContain("RANKING_LEAGUE_OPEN || RANKING_LEAGUE_PREOPEN");
    expect(page).toContain("<RankingPreview state={state} profile={profile} />");
  });
});
