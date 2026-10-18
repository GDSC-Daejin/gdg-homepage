import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildRankingBattleSteps } from "@/app/(member)/pokedex/RankingBattleAnimation";
import { healthColor, impactProfile, sceneQuality } from "@/app/(member)/pokedex/ranking-battle-fx";
import { battleEffect, type BattleType } from "@/lib/pokedex/battle-effects";
import type { RankingBattleDetail, RankingPokemon, RankingTurn } from "@/lib/pokedex/ranking-league";

const read = (path: string) => readFile(path, "utf8");
const TYPES: BattleType[] = ["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "fairy", "steel"];

describe("랭킹전 PixiJS 전투장", () => {
  it("전투 모달에서만 PixiJS를 동적으로 불러오고, 실패하면 React 로그로 돌아간다", async () => {
    const [scene, animation] = await Promise.all([
      read("src/app/(member)/pokedex/PixiRankingBattleScene.tsx"),
      read("src/app/(member)/pokedex/RankingBattleAnimation.tsx"),
    ]);

    expect(scene).toContain('await import("pixi.js")');
    expect(scene).not.toMatch(/^import .*from "pixi\.js"/m);
    expect(scene).toContain("onUnavailable");
    expect(animation).toContain("sceneAvailable");
    expect(animation).toContain("prefers-reduced-motion: reduce");
  });

  it("타입 연출 정보는 battle-effects 한 곳에서 가져온다", async () => {
    const scene = await read("src/app/(member)/pokedex/PixiRankingBattleScene.tsx");
    expect(scene).not.toContain("TYPE_COLORS");
    expect(scene).toContain("battleEffect(");

    for (const type of TYPES) {
      const effect = battleEffect(type);
      expect(effect.palette).toHaveLength(4);
      expect(effect.spritePath).toMatch(/^\/pokedex\/effects\/.+\.webp$/);
    }
    const signature = ["fire", "water", "electric", "grass", "normal"].map((type) => battleEffect(type).motion);
    expect(new Set(signature).size).toBe(5);
    expect(battleEffect("unknown-type")).toBe(battleEffect("normal"));
  });

  it("상성 배율이 클수록 히트스톱·흔들림·이펙트가 커진다", () => {
    const strong = impactProfile(2);
    const normal = impactProfile(1);
    const weak = impactProfile(0.5);
    expect([strong.tier, normal.tier, weak.tier]).toEqual(["strong", "normal", "weak"]);
    expect(strong.hitstop).toBeGreaterThan(normal.hitstop);
    expect(normal.hitstop).toBeGreaterThan(weak.hitstop);
    expect(strong.shake).toBeGreaterThan(normal.shake);
    expect(weak.shake).toBe(0);
    expect(strong.burst).toBeGreaterThan(normal.burst);
    expect(weak.burst).toBeLessThan(normal.burst);
    expect(strong.screenFlash).toBeGreaterThan(0);
    expect(weak.screenFlash).toBe(0);
    // 히트스톱과 체력 감소가 명중 단계 안에서 끝나야 한다.
    const impact = buildRankingBattleSteps(battle()).find((step) => step.phase === "impact");
    expect(strong.hitstop).toBeLessThan(impact!.duration / 2);
  });

  it("좁은 화면은 해상도와 파티클 수를 낮춘다", () => {
    const mobile = sceneQuality(360, 3);
    const desktop = sceneQuality(1080, 2);
    expect(mobile.resolution).toBe(1);
    expect(mobile.maxParticles).toBeLessThan(desktop.maxParticles);
    expect(mobile.particleScale).toBeLessThan(desktop.particleScale);
    expect(desktop.resolution).toBe(2);
  });

  it("단계 타이머는 하나만 돌고, 일시정지·배속을 Pixi 장면에도 전달한다", async () => {
    const [animation, scene] = await Promise.all([
      read("src/app/(member)/pokedex/RankingBattleAnimation.tsx"),
      read("src/app/(member)/pokedex/PixiRankingBattleScene.tsx"),
    ]);
    expect(animation).toContain("const stepKey = `${replayKey}:${stepIndex}`");
    expect(animation).toMatch(/window\.clearTimeout\(timer\)/);
    expect(animation).toContain("stepKey={stepKey}");
    expect(animation).toContain("paused={paused}");
    expect(animation).toContain("speed={speed}");
    expect(scene).toContain("if (!scene.paused) update(scene");
  });

  it("체력 바 접근성 속성과 피해 숫자 팝업을 유지한다", async () => {
    const [animation, styles] = await Promise.all([
      read("src/app/(member)/pokedex/RankingBattleAnimation.tsx"),
      read("src/app/(member)/pokedex/DuelPanel.module.css"),
    ]);
    for (const attribute of ['role="progressbar"', "aria-valuemin={0}", "aria-valuemax={maximum}", "aria-valuenow={health}"]) expect(animation).toContain(attribute);
    expect(animation).toContain("styles.damagePop");
    expect(styles).toContain("@keyframes hp-drain");
    expect(styles).toContain(".fxPaused .healthDrain");
    const reduced = styles.slice(styles.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    for (const name of [".healthDrain", ".damagePop", ".winBanner", ".resultReveal"]) expect(reduced).toContain(name);
  });

  it("체력 색은 남은 비율에 따라 바뀐다", () => {
    expect(healthColor(80)).toBe("#22c55e");
    expect(healthColor(40)).toBe("#facc15");
    expect(healthColor(10)).toBe("#ef4444");
  });

  it("연출 단계는 저장된 전투 로그 순서를 그대로 따른다", () => {
    const steps = buildRankingBattleSteps(battle());
    expect(steps.map((step) => `${step.turn}:${step.phase}:${step.actor ?? "-"}`)).toEqual([
      "0:intro:-",
      "0:charge:attacker", "0:attack:attacker", "0:impact:attacker",
      "1:charge:defender", "1:attack:defender", "1:impact:defender", "1:recall:attacker",
      "2:sendout:-", "2:charge:attacker", "2:attack:attacker", "2:impact:attacker", "2:recall:defender",
      "2:result:-",
    ]);
  });
});

function battle(): RankingBattleDetail {
  const pokemon = (throwId: string, battleType: string): RankingPokemon => ({ throwId, pokemonId: throwId, name: throwId, imagePath: "", combatPower: 0, battleType, rarity: "common" });
  const turn = (actor: RankingTurn["actor"], attackerIndex: number, attackerDamage: number, defenderDamage: number, attackerHealth: number, defenderHealth: number): RankingTurn => ({ actor, attackerIndex, defenderIndex: 0, attackerDamage, defenderDamage, attackerHealth, defenderHealth, attackerTypeMultiplier: 1, defenderTypeMultiplier: 2, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 });
  return {
    id: "fx", attackerId: "a", defenderId: "d", attackerTeam: [pokemon("a1", "fire"), pokemon("a2", "electric")], defenderTeam: [pokemon("d1", "water")],
    battleLog: [turn("attacker", 0, 300, 0, 1000, 700), turn("defender", 0, 0, 1000, 0, 700), turn("attacker", 1, 700, 0, 1000, 0)],
    winnerId: "a", firstTurnUserId: "a", attackerDelta: 30, defenderDelta: -10, createdAt: "2026-10-18T00:00:00.000Z",
  };
}
