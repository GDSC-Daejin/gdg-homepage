import { access, readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildRankingBattleSteps } from "@/app/(member)/pokedex/RankingBattleAnimation";
import type { RankingBattleDetail, RankingPokemon, RankingTurn } from "@/lib/pokedex/ranking-league";

const pokemon = (throwId: string): RankingPokemon => ({ throwId, pokemonId: throwId, name: throwId, imagePath: "", combatPower: 100, battleType: "normal", rarity: "common" });
const turn = (actor: RankingTurn["actor"], attackerDamage: number, defenderDamage: number): RankingTurn => ({ actor, attackerIndex: 0, defenderIndex: 0, attackerDamage, defenderDamage, attackerHealth: 900, defenderHealth: 900, attackerTypeMultiplier: 1, defenderTypeMultiplier: 1, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 });
const battle = (firstTurnUserId: string | null): RankingBattleDetail => ({ id: "battle", attackerId: "a", defenderId: "d", attackerTeam: [pokemon("a1")], defenderTeam: [pokemon("d1")], battleLog: [turn("defender", 0, 50), turn("attacker", 40, 0)], winnerId: "a", firstTurnUserId, attackerDelta: 30, defenderDelta: -10, createdAt: "2026-09-24T03:00:00.000Z" });

describe("도감 전투 선공", () => {
  it("친선전과 랭킹전의 첫 턴을 서버 동전으로 한 번만 확정한다", async () => {
    const migration = (await readdir("supabase/migrations")).find((file) => file === "0082_pokedex_turn_order.sql");
    expect(migration).toBeDefined();
    if (!migration) return;

    const sql = await readFile(`supabase/migrations/${migration}`, "utf8");
    expect(sql).toContain("first_turn_user_id");
    expect(sql).toContain("v_first_turn_user");
    expect(sql).toContain("random() < 0.5");
    expect(sql).toContain("v_turn_side := case when v_turn_side = 'attacker' then 'defender' else 'attacker' end");
    expect(sql).toContain("pokedex_duel_accept");
    expect(sql).toContain("pokedex_rank_start_battle");
  });

  it("저장된 선공 결과를 동전 연출과 공격 단위 로그로 재생한다", async () => {
    const [duel, ranking, styles] = await Promise.all([
      readFile("src/app/(member)/pokedex/DuelPanel.tsx", "utf8"),
      readFile("src/app/(member)/pokedex/RankingBattleAnimation.tsx", "utf8"),
      readFile("src/app/(member)/pokedex/DuelPanel.module.css", "utf8"),
    ]);

    expect(duel).toContain("firstTurnUserId");
    expect(ranking).toContain("firstTurnUserId");
    expect(duel).toContain("BattleCoin");
    expect(ranking).toContain("BattleCoin");
    expect(duel).toContain('setIntro("firstTurn")');
    // 랭킹전은 단계(step) 재생: 저장된 선공이 있으면 동전(intro)부터, 이후 공격마다 차징·공격·명중을 한 번씩 재생한다.
    expect(buildRankingBattleSteps(battle("d")).map((step) => `${step.phase}:${step.actor ?? "-"}`)).toEqual([
      "intro:-",
      "charge:defender", "attack:defender", "impact:defender",
      "charge:attacker", "attack:attacker", "impact:attacker",
      "result:-",
    ]);
    expect(buildRankingBattleSteps(battle(null))[0].phase).toBe("charge");
    expect(ranking).toContain('step.phase === "intro" && battle.firstTurnUserId && <div className={`${styles.coinToss}');
    expect(ranking).toContain("<BattleCoin heads={battle.firstTurnUserId === battle.attackerId}");
    expect(styles).toContain(".firstTurn");
    expect(styles).toContain("will-change: transform");
    expect(styles).toContain("prefers-reduced-motion: reduce");
  });

  it("친선전의 공격 로그는 투사체 단계를 거쳐 재생한다", async () => {
    const duel = await readFile("src/app/(member)/pokedex/DuelPanel.tsx", "utf8");

    expect(duel).toContain("setEffectStage(1)");
    expect(duel).toContain("setEffectStage(2)");
    expect(duel).toContain("stage={effectStage}");
  });

  it("전장 위에서 피카츄·몬스터볼 도트 주화를 재생한다", async () => {
    const coin = (await readdir("src/app/(member)/pokedex")).find((file) => file === "BattleCoin.tsx");
    expect(coin).toBeDefined();
    if (!coin) return;

    const [component, duel, ranking] = await Promise.all([
      readFile("src/app/(member)/pokedex/BattleCoin.tsx", "utf8"),
      readFile("src/app/(member)/pokedex/DuelPanel.tsx", "utf8"),
      readFile("src/app/(member)/pokedex/RankingBattleAnimation.tsx", "utf8"),
    ]);
    await expect(access("public/pokedex/effects/coin-pikachu.png")).resolves.toBeUndefined();
    await expect(access("public/pokedex/effects/coin-monster-ball.png")).resolves.toBeUndefined();
    expect(component).toContain("/pokedex/effects/coin-pikachu.png");
    expect(component).toContain("/pokedex/effects/coin-monster-ball.png");
    expect(component).toContain("requestAnimationFrame");
    expect(component).toContain("gravity");
    expect(component).toContain("rotateX");
    expect(duel).toContain("<BattleCoin");
    expect(ranking).toContain("<BattleCoin");
    expect(duel).not.toContain('if (turn < 0) return <div className="text-center"><div className={styles.coinToss}');
  });
});
