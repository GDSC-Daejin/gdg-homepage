import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("도감 랭킹전 탭", () => {
  it("랭킹전 상태를 불러와 별도 탭으로 렌더링한다", async () => {
    const page = await readFile("src/app/(member)/pokedex/page.tsx", "utf8");
    expect(page).toContain('requestedTab === "ranking"');
    expect(page).toContain("랭킹전");
    expect(page).toContain("pokedex_rank_state");
    expect(page).toContain("RankingLeaguePanel");
  });
});
