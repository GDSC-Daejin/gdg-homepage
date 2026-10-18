import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { MOVE_POOLS, moveAnimUrl, moveDisplayName, movePool, moveSoundUrl } from "@/app/(member)/pokedex/ranking-battle-assets";
import { healthBarRow } from "@/app/(member)/pokedex/ranking-battle-fx";
import { mapAnimPoint, moveFrameMs, parseMoveAnim } from "@/app/(member)/pokedex/ranking-move-anim";
import { buildRankingBattleSteps } from "@/app/(member)/pokedex/RankingBattleAnimation";

const read = (path: string) => readFile(path, "utf8");

describe("랭킹전 PokéRogue 기술 재생", () => {
  it("모든 타입에 무작위로 고를 기술이 있고 한국어 이름이 있다", () => {
    for (const [type, moves] of Object.entries(MOVE_POOLS)) {
      expect(moves.length, type).toBeGreaterThanOrEqual(3);
      for (const move of moves) expect(moveDisplayName(move), move).not.toBe(move);
    }
    expect(movePool("unknown")).toBe(MOVE_POOLS.normal);
    expect(moveAnimUrl("water-gun")).toBe("https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/battle-anims/water-gun.json");
    expect(moveSoundUrl("PRSFX- Ember.wav")).toContain("/audio/battle_anims/PRSFX-%20Ember.wav");
  });

  it("기술 JSON을 검증하며 해석하고, 잘못된 형식은 null로 대체한다", () => {
    const raw = { graphic: "PRAS- Fire", frames: [[{ x: 10, y: -5, zoomX: 150, zoomY: 150, visible: true, target: 2, graphicFrame: 36, opacity: 85, blendType: 1 }, { x: "bad", target: 0 }], "nope"], frameTimedEvents: { 5: [{ eventType: "AnimTimedSoundEvent", resourceName: "PRSFX- Ember.wav", volume: 80 }, { eventType: "AnimTimedAddBgEvent" }] } };
    const anim = parseMoveAnim(raw, false)!;
    expect(anim.graphic).toBe("PRAS- Fire");
    expect(anim.frames).toHaveLength(2);
    expect(anim.frames[0][0]).toMatchObject({ x: 10, y: -5, zoomX: 150, graphicFrame: 36, opacity: 85, blendType: 1, angle: 0, mirror: false });
    expect(anim.frames[0][1]).toMatchObject({ x: 0, target: 0 });
    expect(anim.frames[1]).toEqual([]);
    expect(anim.sounds).toEqual([{ frame: 5, resource: "PRSFX- Ember.wav", volume: 0.8 }]);
    // 배열 형식이면 첫 번째(아래쪽 시전) 변형을 쓴다.
    expect(parseMoveAnim([raw, { graphic: "Other", frames: [[]] }], false)?.graphic).toBe("PRAS- Fire");
    expect(parseMoveAnim({ frames: [] }, false)).toBeNull();
    expect(parseMoveAnim(null, false)).toBeNull();
  });

  it("애니메이션 좌표를 시전자→대상 방향에 맞춰 화면 좌표로 바꾼다", () => {
    const user = { x: 100, y: 300 };
    const target = { x: 500, y: 100 };
    expect(mapAnimPoint(0, 0, user, target)).toEqual(user);
    expect(mapAnimPoint(128, -64, user, target)).toEqual(target);
    expect(mapAnimPoint(64, -32, user, target)).toEqual({ x: 300, y: 200 });
    // 위쪽(상대)이 시전하면 방향이 뒤집힌다.
    expect(mapAnimPoint(128, -64, target, user)).toEqual(user);
  });

  it("기술은 공격 단계 끝(명중 직전)에 맞춰 끝나도록 프레임 간격을 정한다", () => {
    const attack = buildRankingBattleSteps({ id: "b", attackerId: "a", defenderId: "d", attackerTeam: [], defenderTeam: [], battleLog: [{ actor: "attacker", attackerIndex: 0, defenderIndex: 0, attackerDamage: 1, defenderDamage: 0, attackerHealth: 1, defenderHealth: 1, attackerTypeMultiplier: 1, defenderTypeMultiplier: 1, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 }], winnerId: "a", attackerDelta: 0, defenderDelta: 0, createdAt: "" }).find((step) => step.phase === "attack")!;
    expect(moveFrameMs(10, attack.duration + 150)).toBe(50);
    expect(moveFrameMs(36, attack.duration + 150)).toBeCloseTo(800 / 36);
    expect(moveFrameMs(100, attack.duration + 150)).toBe(22);
  });

  it("고른 기술 이름을 메시지 박스에 텍스트로 보여주고, 공격음은 장면이 기술 효과음으로 낸다", async () => {
    const [animation, scene] = await Promise.all([read("src/app/(member)/pokedex/RankingBattleAnimation.tsx"), read("src/app/(member)/pokedex/PixiRankingBattleScene.tsx")]);
    expect(animation).toContain("moveDisplayName(chosenMove.move)");
    expect(animation).toContain('if (sound && sound.kind !== "attack") audio.play(sound, speed);');
    expect(scene).toContain("latest.current.onMove?.(stepKey, scene.move?.name ?? null);");
    expect(scene).toContain("sound?.play(moveSoundUrl(effect.resource), effect.volume);");
  });

  it("정보창은 PokéRogue UI 이미지를 쓰고 progressbar 접근성 속성을 유지한다", async () => {
    const [animation, styles] = await Promise.all([read("src/app/(member)/pokedex/RankingBattleAnimation.tsx"), read("src/app/(member)/pokedex/DuelPanel.module.css")]);
    for (const image of ["pbinfo_enemy_mini.png", "pbinfo_player.png", "overlay_hp.png"]) expect(styles).toContain(`pokerogue-assets/beta/images/ui/${image}`);
    expect(animation).toContain('className={styles.pbHpSlot} role="progressbar"');
    expect([healthBarRow(80), healthBarRow(40), healthBarRow(10)]).toEqual([0, 1, 2]);
  });
});
