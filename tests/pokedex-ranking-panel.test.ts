import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { shouldShowRankingPokemon, toggleRankingPresetMember } from "@/app/(member)/pokedex/RankingLeaguePanel";
import { latestFunction } from "./migration-sql";

describe("도감 랭킹전 화면", () => {
  it("코인과 선공 안내 중에는 포켓몬을 숨긴다", () => {
    expect(shouldShowRankingPokemon("coin", false)).toBe(false);
    expect(shouldShowRankingPokemon("firstTurn", false)).toBe(false);
    expect(shouldShowRankingPokemon("throw", false)).toBe(false);
    expect(shouldShowRankingPokemon("release", false)).toBe(true);
  });

  it("프리셋 카드는 세 마리까지만 선택하고 다시 누르면 해제한다", () => {
    expect(toggleRankingPresetMember(["a", "b", "c"], "d")).toEqual(["a", "b", "c"]);
    expect(toggleRankingPresetMember(["a", "b"], "c")).toEqual(["a", "b", "c"]);
    expect(toggleRankingPresetMember(["a", "b"], "b")).toEqual(["a"]);
  });

  it("오늘의 상대에 프로필 아바타 경로를 포함한다", async () => {
    const [panel, state] = await Promise.all([
      readFile("src/app/(member)/pokedex/RankingLeaguePanel.tsx", "utf8"),
      latestFunction("pokedex_rank_state"),
    ]);

    expect(panel).toContain("opponent.avatarPath");
    expect(panel).toContain("opponent.partyType");
    expect(state).toContain("'avatarPath', p.avatar_path");
    expect(state).toContain("'partyType'");
  });

  it("상태 RPC가 내 순위·리더보드 id·전투 역할·상대 닉네임을 내려준다", async () => {
    const state = await latestFunction("pokedex_rank_state");

    expect(state).toContain("'rank', (select r.final_rank");
    expect(state).toContain("'userId', user_id");
    expect(state).toContain("'role', case when b.attacker_id = v_user then 'attacker' else 'defender' end");
    expect(state).toContain("'opponentNickname'");
  });

  it("리더보드는 이름 대신 id로 나를 찾고, 상위 20명 밖이면 내 순위 행을 따로 붙인다", async () => {
    const panel = await readFile("src/app/(member)/pokedex/RankingLeaguePanel.tsx", "utf8").catch(() => "");
    expect(panel).toContain("member.userId === profileId");
    expect(panel).toContain("inTopBoard");
    expect(panel).toContain("entry.rank");
  });

  it("전투 기록을 공격·방어로 나눠 보여주고 걸러낼 수 있다", async () => {
    const panel = await readFile("src/app/(member)/pokedex/RankingLeaguePanel.tsx", "utf8").catch(() => "");
    expect(panel).toContain("logFilter");
    expect(panel).toContain('item.role === "attacker" ? "공격" : "방어"');
    expect(panel).toContain("battleDelta(item)");
  });

  it("오늘 할 일·점수 추이·시즌 진행을 요약한다", async () => {
    const panel = await readFile("src/app/(member)/pokedex/RankingLeaguePanel.tsx", "utf8").catch(() => "");
    for (const label of ["ScoreTrend", "AttackPips", "시즌 진행", "최고 연승", "방어 승률"]) expect(panel).toContain(label);
  });

  it("등급·티어가 아니라 1,000점에서 시작하는 점수제만 쓴다", async () => {
    const panel = await readFile("src/app/(member)/pokedex/RankingLeaguePanel.tsx", "utf8").catch(() => "");
    expect(panel).toContain("RANKING_START_RATING");
    for (const tier of ["브론즈", "실버", "골드", "마스터"]) expect(panel).not.toContain(tier);
  });

  it("상대 방어 덱은 선봉 한 칸만 공개하고 나머지 두 칸은 미공개로 둔다", async () => {
    const panel = await readFile("src/app/(member)/pokedex/RankingLeaguePanel.tsx", "utf8").catch(() => "");
    expect(panel).toContain("상대 방어 덱");
    expect(panel).toContain("미공개");
    // 상대 파티에서 화면에 그리는 이미지는 공개된 선봉뿐이다.
    expect(panel).not.toContain("opponent.defenderTeam");
  });

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
    const animation = await readFile("src/app/(member)/pokedex/RankingBattleAnimation.tsx", "utf8").catch(() => "");
    expect(animation).toContain("RankingBattleAnimation");
    expect(animation).toContain("PixelBattleEffect");
  });

  it("랭킹전 연출은 순차 반격과 쓰러진 포켓몬 회수를 재생한다", async () => {
    const animation = await readFile("src/app/(member)/pokedex/RankingBattleAnimation.tsx", "utf8").catch(() => "");
    expect(animation).toContain('"defenderAttack"');
    expect(animation).toContain('"recallOut"');
  });

  it("쓰러진 방어 포켓몬의 반격 연출을 생략한다", async () => {
    const animation = await readFile("src/app/(member)/pokedex/RankingBattleAnimation.tsx", "utf8").catch(() => "");
    expect(animation).toContain("entry.defenderDamage > 0");
  });

  it("회수 완료 뒤 같은 몬스터볼을 유지한 채 교대한다", async () => {
    const animation = await readFile("src/app/(member)/pokedex/RankingBattleAnimation.tsx", "utf8").catch(() => "");
    expect(animation).toContain('"recallDone"');
    expect(animation).toContain("recallBallVisible");
    expect(animation).not.toContain("groundedBall");
  });

  it("회수 빔이 끝날 때까지 쓰러진 포켓몬을 다시 표시하지 않는다", async () => {
    const animation = await readFile("src/app/(member)/pokedex/RankingBattleAnimation.tsx", "utf8").catch(() => "");
    expect(animation).toContain("attackerRecalled");
    expect(animation).toContain("defenderRecalled");
    expect(animation).toContain("delay += 900");
  });

  it("교대 몬스터볼 투척 중에는 다음 포켓몬 이미지를 렌더하지 않는다", async () => {
    const animation = await readFile("src/app/(member)/pokedex/RankingBattleAnimation.tsx", "utf8").catch(() => "");
    expect(animation).toContain("showAttacker");
    expect(animation).toContain("showDefender");
  });

  it("교대 몬스터볼은 비행 애니메이션이 끝난 뒤 포켓몬을 내보낸다", async () => {
    const animation = await readFile("src/app/(member)/pokedex/RankingBattleAnimation.tsx", "utf8").catch(() => "");
    expect(animation).toContain('setPhase("sendoutThrow"); }, delay));\n        delay += 900;');
  });
});
