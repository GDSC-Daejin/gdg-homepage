import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("도감 랭킹전 화면", () => {
  it("프리셋·일일 상대·상세 전투 기록을 제공한다", async () => {
    const panel = await readFile("src/app/(member)/pokedex/RankingLeaguePanel.tsx", "utf8").catch(() => "");
    for (const label of ["방어 프리셋", "공격 프리셋", "상대 리롤", "전투 기록", "참전하기"]) expect(panel).toContain(label);
    expect(panel).toContain("startRankingBattle");
    expect(panel).toContain("getRankingBattleDetail");
  });

  it("미리보기 전투 기록에 선택한 공격 프리셋을 사용한다", async () => {
    const panel = await readFile("src/app/(member)/pokedex/RankingLeaguePanel.tsx", "utf8").catch(() => "");
    expect(panel).toContain("attackerTeam: state.presets.find");
  });

  it("턴별 전투 로그를 3:3 연출로 재생한다", async () => {
    const panel = await readFile("src/app/(member)/pokedex/RankingLeaguePanel.tsx", "utf8").catch(() => "");
    expect(panel).toContain("RankingBattleAnimation");
    expect(panel).toContain("PixelBattleEffect");
  });

  it("랭킹전 연출은 순차 반격과 쓰러진 포켓몬 회수를 재생한다", async () => {
    const panel = await readFile("src/app/(member)/pokedex/RankingLeaguePanel.tsx", "utf8").catch(() => "");
    expect(panel).toContain('"defenderAttack"');
    expect(panel).toContain('"recallOut"');
  });

  it("쓰러진 방어 포켓몬의 반격 연출을 생략한다", async () => {
    const panel = await readFile("src/app/(member)/pokedex/RankingLeaguePanel.tsx", "utf8").catch(() => "");
    expect(panel).toContain("entry.defenderDamage > 0");
  });

  it("회수 완료 뒤 같은 몬스터볼을 유지한 채 교대한다", async () => {
    const panel = await readFile("src/app/(member)/pokedex/RankingLeaguePanel.tsx", "utf8").catch(() => "");
    expect(panel).toContain('"recallDone"');
    expect(panel).toContain("recallBallVisible");
    expect(panel).not.toContain("groundedBall");
  });

  it("회수 빔이 끝날 때까지 쓰러진 포켓몬을 다시 표시하지 않는다", async () => {
    const panel = await readFile("src/app/(member)/pokedex/RankingLeaguePanel.tsx", "utf8").catch(() => "");
    expect(panel).toContain("attackerRecalled");
    expect(panel).toContain("defenderRecalled");
    expect(panel).toContain("delay += 900");
  });

  it("교대 몬스터볼 투척 중에는 다음 포켓몬 이미지를 렌더하지 않는다", async () => {
    const panel = await readFile("src/app/(member)/pokedex/RankingLeaguePanel.tsx", "utf8").catch(() => "");
    expect(panel).toContain("showAttacker");
    expect(panel).toContain("showDefender");
  });

  it("교대 몬스터볼은 비행 애니메이션이 끝난 뒤 포켓몬을 내보낸다", async () => {
    const panel = await readFile("src/app/(member)/pokedex/RankingLeaguePanel.tsx", "utf8").catch(() => "");
    expect(panel).toContain('setPhase("sendoutThrow"); }, delay));\n        delay += 900;');
  });
});
