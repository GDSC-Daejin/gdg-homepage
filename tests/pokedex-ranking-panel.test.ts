import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("도감 랭킹전 화면", () => {
  it("프리셋·일일 상대·상세 전투 기록을 제공한다", async () => {
    const panel = await readFile("src/app/(member)/pokedex/RankingLeaguePanel.tsx", "utf8").catch(() => "");
    for (const label of ["방어 프리셋", "공격 프리셋", "상대 리롤", "전투 기록", "참전하기"]) expect(panel).toContain(label);
    expect(panel).toContain("startRankingBattle");
    expect(panel).toContain("getRankingBattleDetail");
  });
});
