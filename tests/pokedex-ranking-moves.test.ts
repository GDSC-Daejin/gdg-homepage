import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { FIELD, FIELD_SPOTS, MOVE_FRAME_MS, MOVE_POOLS, moveAnimUrl, moveDisplayName, moveDurationMs, movePool, moveSoundUrl, randomMove } from "@/app/(member)/pokedex/ranking-battle-assets";
import { healthBarRow } from "@/app/(member)/pokedex/ranking-battle-fx";
import { interpolateFrame, parseMoveAnim, placeMoveElement, toneMatrix } from "@/app/(member)/pokedex/ranking-move-anim";
import { buildRankingBattleSteps, planRankingMoves } from "@/app/(member)/pokedex/RankingBattleAnimation";
import type { RankingBattleDetail } from "@/lib/pokedex/ranking-league";

const read = (path: string) => readFile(path, "utf8");

describe("랭킹전 PokéRogue 기술 재생", () => {
  it("모든 타입에 무작위로 고를 기술이 있고 한국어 이름이 있다", () => {
    for (const [type, moves] of Object.entries(MOVE_POOLS)) {
      expect(moves.length, type).toBeGreaterThanOrEqual(3);
      for (const [move, frames] of moves) {
        expect(moveDisplayName(move), move).not.toBe(move);
        expect(frames).toBeLessThanOrEqual(36);
      }
    }
    expect(movePool("unknown")).toEqual(movePool("normal"));
    expect(MOVE_FRAME_MS).toBe(50);
    expect(moveDurationMs("ember")).toBe(14 * 50);
    expect(moveAnimUrl("water-gun")).toBe("https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/battle-anims/water-gun.json");
    expect(moveSoundUrl("PRSFX- Ember.wav")).toContain("/audio/battle_anims/PRSFX-%20Ember.wav");
  });

  it("기술 JSON을 검증하며 해석하고, 잘못된 형식은 null로 대체한다", () => {
    const raw = { graphic: "PRAS- Fire", frames: [[{ x: 10, y: -5, zoomX: 150, zoomY: 150, visible: true, target: 2, graphicFrame: 36, opacity: 85, blendType: 1 }, { x: "bad", target: 0 }], "nope"], frameTimedEvents: { 5: [{ eventType: "AnimTimedSoundEvent", resourceName: "PRSFX- Ember.wav", volume: 80 }, { eventType: "AnimTimedAddBgEvent" }] } };
    const anim = parseMoveAnim(raw)!.main;
    expect(anim.graphic).toBe("PRAS- Fire");
    expect(anim.frames).toHaveLength(2);
    expect(anim.frames[0][0]).toMatchObject({ x: 10, y: -5, zoomX: 150, graphicFrame: 36, opacity: 85, blendType: 1, angle: 0, mirror: false, focus: 1 });
    expect(anim.frames[0][1]).toMatchObject({ x: 0, target: 0 });
    expect(anim.frames[1]).toEqual([]);
    expect(anim.sounds).toEqual([{ frame: 5, resource: "PRSFX- Ember.wav", volume: 0.8, pitch: 1 }]);
    // 배열 형식이면 [0]이 기본, [1]이 상대 시전용 변형이다.
    const set = parseMoveAnim([raw, { graphic: "Other", frames: [[]] }])!;
    expect(set.main.graphic).toBe("PRAS- Fire");
    expect(set.opponent?.graphic).toBe("Other");
    expect(parseMoveAnim(raw)?.opponent).toBeNull();
    expect(parseMoveAnim({ frames: [] })).toBeNull();
    expect(parseMoveAnim(null)).toBeNull();
  });

  it("배경 이벤트·색조·그리는 순서를 해석하고, 프레임 사이를 보간한다", () => {
    const raw = { graphic: "G", frames: [[{ x: 0, y: 0, target: 2, focus: 3, priority: 2, tone: [255, -100, 0, 128] }], [{ x: 10, y: -10, target: 2, focus: 3, opacity: 0 }]], frameTimedEvents: { 0: [{ eventType: "AnimTimedAddBgEvent", resourceName: "PRAS- Aurora BG", bgX: 0, bgY: 0, opacity: 0, duration: 5 }, { eventType: "AnimTimedUpdateBgEvent", resourceName: "", bgX: 400, bgY: 200, opacity: 255, duration: 3 }] } };
    const anim = parseMoveAnim(raw)!.main;
    expect(anim.backgrounds).toEqual([
      { frame: 0, kind: "add", resource: "PRAS- Aurora BG", bgX: 0, bgY: 0, opacity: 0, duration: 5 },
      { frame: 0, kind: "update", resource: "", bgX: 400, bgY: 200, opacity: 255, duration: 3 },
    ]);
    expect(anim.frames[0][0]).toMatchObject({ priority: 2, tone: [255, -100, 0, 128] });
    const half = interpolateFrame(anim.frames[0], anim.frames[1], 0.5)[0];
    expect(half).toMatchObject({ x: 5, y: -5, tone: [255, -100, 0, 128] });
    // 다음 프레임에서 보이지 않는 요소와는 보간하지 않는다(갑자기 사라지는 원작 동작 유지).
    expect(interpolateFrame(anim.frames[0], [{ ...anim.frames[1][0], visible: false }], 0.5)[0].x).toBe(0);
    const matrix = toneMatrix([255, 0, -255, 0]);
    expect(matrix.slice(0, 5)).toEqual([1, 0, 0, 0, 1]);
    expect(matrix[14]).toBe(-1);
    expect(toneMatrix([0, 0, 0, 255]).slice(0, 3)).toEqual([0.299, 0.587, 0.114]);
  });

  it("PokéRogue와 같은 기준점 규칙으로 화면 위치를 정한다", () => {
    const user = { x: 100, y: 300 };
    const target = { x: 500, y: 100 };
    const field = { x: 0, y: 0, scale: 2 };
    // 보간(3): 기준점 (0,0)→시전자, (128,-64)→대상, 방향이 뒤집히면 이펙트도 뒤집는다.
    expect(placeMoveElement({ x: 0, y: 0, focus: 3, target: 2 }, user, target, field)).toEqual({ ...user, flip: false });
    expect(placeMoveElement({ x: 128, y: -64, focus: 3, target: 2 }, user, target, field)).toEqual({ ...target, flip: false });
    expect(placeMoveElement({ x: 64, y: -32, focus: 3, target: 2 }, target, user, field)).toEqual({ x: 300, y: 200, flip: true });
    // 대상 기준(1)·시전자 기준(2): 필드 픽셀만큼 그대로 옮긴다.
    expect(placeMoveElement({ x: 138, y: -64, focus: 1, target: 2 }, user, target, field)).toEqual({ x: 520, y: 100, flip: false });
    expect(placeMoveElement({ x: 5, y: 5, focus: 2, target: 2 }, user, target, field)).toEqual({ x: 110, y: 310, flip: false });
    // 화면 고정(4): 필드 좌표 그대로
    expect(placeMoveElement({ x: 0, y: 0, focus: 4, target: 2 }, user, target, field)).toEqual({ x: 212, y: 232, flip: false });
  });

  it("공격 단계마다 타입 기술을 무작위로 고르고, 단계 길이를 기술 길이에 맞춘다", () => {
    const battle = { id: "b", attackerId: "a", defenderId: "d", attackerTeam: [{ throwId: "f", pokemonId: "f", name: "f", imagePath: "", combatPower: 1, battleType: "fire", rarity: "common" }], defenderTeam: [{ throwId: "w", pokemonId: "w", name: "w", imagePath: "", combatPower: 1, battleType: "water", rarity: "common" }], battleLog: [{ actor: "attacker", attackerIndex: 0, defenderIndex: 0, attackerDamage: 1, defenderDamage: 0, attackerHealth: 1, defenderHealth: 1, attackerTypeMultiplier: 1, defenderTypeMultiplier: 1, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 }, { actor: "defender", attackerIndex: 0, defenderIndex: 0, attackerDamage: 0, defenderDamage: 1, attackerHealth: 1, defenderHealth: 1, attackerTypeMultiplier: 1, defenderTypeMultiplier: 1, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 }], winnerId: "a", attackerDelta: 0, defenderDelta: 0, createdAt: "" } as RankingBattleDetail;
    const planned = planRankingMoves(buildRankingBattleSteps(battle), battle, () => 0);
    const attacks = planned.filter((step) => step.phase === "attack");
    expect(attacks.map((step) => step.move)).toEqual([movePool("fire")[0], movePool("water")[0]]);
    expect(attacks[0].duration).toBe(Math.max(650, moveDurationMs(movePool("fire")[0])));
    expect(planned.filter((step) => step.phase !== "attack").every((step) => step.move === undefined)).toBe(true);
    expect(randomMove("fire", () => 0.999)).toBe(movePool("fire").at(-1));
  });

  it("고른 기술 이름을 메시지 박스에 텍스트로 보여주고, 공격음은 장면이 기술 효과음으로 낸다", async () => {
    const [animation, scene] = await Promise.all([read("src/app/(member)/pokedex/RankingBattleAnimation.tsx"), read("src/app/(member)/pokedex/PixiRankingBattleScene.tsx")]);
    expect(animation).toContain("moveDisplayName(step.move)");
    expect(animation).toContain('if (sound && sound.kind !== "attack") audio.play(sound, speed);');
    expect(scene).toContain("scene.move = startMove(scene, actor, latest.current.move ?? null);");
    expect(scene).toContain("sound?.play(moveSoundUrl(effect.resource), effect.volume, effect.pitch);");
  });

  it("장면을 320×180 필드로 그려 확대하고, 원작 자리·메시지창 배치를 따른다", async () => {
    const [scene, animation, styles] = await Promise.all([read("src/app/(member)/pokedex/PixiRankingBattleScene.tsx"), read("src/app/(member)/pokedex/RankingBattleAnimation.tsx"), read("src/app/(member)/pokedex/DuelPanel.module.css")]);
    expect(FIELD).toEqual({ width: 320, height: 180, messageHeight: 48 });
    expect(FIELD_SPOTS).toEqual({ attacker: { x: 106, y: 148 }, defender: { x: 236, y: 84 } });
    expect(scene).toContain("pixi.RenderTexture.create({ width: FIELD.width, height: FIELD.height, resolution: 1 })");
    expect(scene).toContain('fieldTexture.source.scaleMode = "nearest";');
    expect(animation).toContain('<div className={styles.pbMessage} aria-live="polite">');
    expect(styles).toContain("--u: calc(100cqw / 320)");
    expect(styles).toContain("pokerogue-assets/beta/images/ui/bg.png");
  });

  it("정보창은 PokéRogue UI 이미지를 쓰고 progressbar 접근성 속성을 유지한다", async () => {
    const [animation, styles] = await Promise.all([read("src/app/(member)/pokedex/RankingBattleAnimation.tsx"), read("src/app/(member)/pokedex/DuelPanel.module.css")]);
    for (const image of ["pbinfo_enemy_mini.png", "pbinfo_player.png", "overlay_hp.png"]) expect(styles).toContain(`pokerogue-assets/beta/images/ui/${image}`);
    expect(animation).toContain('className={styles.pbHpSlot} role="progressbar"');
    expect([healthBarRow(80), healthBarRow(40), healthBarRow(10)]).toEqual([0, 1, 2]);
  });
});
