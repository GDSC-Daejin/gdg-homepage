import { access, readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

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
    expect(ranking).toContain('setPhase("firstTurn")');
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
