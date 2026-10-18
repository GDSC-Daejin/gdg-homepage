"use client";

import { useEffect, useRef } from "react";
import type { RankingPokemon } from "@/lib/pokedex/ranking-league";
import { battleEffect, type BattleMotion, type BattlePalette } from "@/lib/pokedex/battle-effects";
import { BATTLE_EFFECT_SHEETS, battleSpriteCandidates, effectCell, type EffectSheet, type SpriteCandidate } from "./ranking-battle-assets";
import { clamp01, easeInCubic, easeOutBack, easeOutCubic, impactProfile, lerp, sceneQuality, segment, type ImpactProfile } from "./ranking-battle-fx";

export type RankingScenePhase = "intro" | "sendout" | "charge" | "attack" | "impact" | "recall" | "result";
type SideKey = "attacker" | "defender";
type Pixi = typeof import("pixi.js");

const ENTRANCE_MS = 820;
const BALL_OPEN = 0.46;

type Particle = {
  x: number; y: number; vx: number; vy: number; gravity: number; drag: number;
  life: number; maxLife: number; size: number; color: string; shape: "dot" | "pixel" | "diamond" | "spark" | "star"; spin: number; angle: number;
};

type GifFrame = { texture: import("pixi.js").Texture; start: number; end: number };
type Visual = { texture: import("pixi.js").Texture; frames: GifFrame[] | null; candidate: SpriteCandidate };
type SheetFrames = import("pixi.js").Texture[];

type Side = {
  sprite: import("pixi.js").Sprite;
  flash: import("pixi.js").Sprite;
  frames: GifFrame[] | null;
  frameTime: number;
  candidate: SpriteCandidate;
  key: string | null;
  entrance: number | null;
  entranceBurst: boolean;
  hidden: boolean;
  baseScale: number;
};

type Scene = {
  pixi: Pixi;
  app: import("pixi.js").Application;
  world: import("pixi.js").Container;
  back: import("pixi.js").Graphics;
  shapes: import("pixi.js").Graphics;
  particles: import("pixi.js").Graphics;
  overlay: import("pixi.js").Graphics;
  projectile: import("pixi.js").Sprite;
  effect: import("pixi.js").Sprite;
  sheets: Map<string, SheetFrames | null>;
  sides: Record<SideKey, Side>;
  pool: Particle[];
  typeTextures: Map<string, import("pixi.js").Texture | null>;
  quality: ReturnType<typeof sceneQuality>;
  phase: RankingScenePhase;
  actor: SideKey | null;
  duration: number;
  multiplier: number;
  winner: SideKey;
  types: Record<SideKey, string>;
  stepKey: string;
  elapsed: number;
  clock: number;
  speed: number;
  paused: boolean;
  burstDone: boolean;
  emitDebt: number;
  bolt: { at: number; points: number[] };
};

export function PixiRankingBattleScene({ attacker, defender, phase, actor, duration, multiplier, winner, stepKey, replayKey, speed, paused, onUnavailable }: {
  attacker: RankingPokemon;
  defender: RankingPokemon;
  phase: RankingScenePhase;
  actor: SideKey | null;
  /** 현재 단계의 재생 길이(ms, 1배속 기준) */
  duration: number;
  /** 현재 공격의 상성 배율 */
  multiplier: number;
  winner: SideKey;
  /** 단계마다 달라지는 키. 바뀌면 단계 시계를 0으로 돌린다. */
  stepKey: string;
  /** 다시 보기마다 달라지는 키. 바뀌면 양측 등장 연출을 다시 시작한다. */
  replayKey: number;
  speed: number;
  paused: boolean;
  onUnavailable: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const latest = useRef({ attacker, defender, phase, actor, duration, multiplier, winner, stepKey, speed, paused, onUnavailable });
  latest.current = { attacker, defender, phase, actor, duration, multiplier, winner, stepKey, speed, paused, onUnavailable };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const target = host;
    let cancelled = false;
    let app: import("pixi.js").Application | null = null;

    async function mount() {
      try {
        const [pixi] = await Promise.all([import("pixi.js"), import("pixi.js/gif")]);
        const quality = sceneQuality(target.clientWidth, window.devicePixelRatio);
        app = new pixi.Application();
        await app.init({ resizeTo: target, backgroundAlpha: 0, antialias: false, autoDensity: true, resolution: quality.resolution, preference: "webgl" });
        if (cancelled) return;
        target.replaceChildren(app.canvas);

        const props = latest.current;
        const [attackerVisual, defenderVisual] = await Promise.all([loadVisual(pixi, props.attacker.imagePath, "attacker"), loadVisual(pixi, props.defender.imagePath, "defender")]);
        if (cancelled) return;

        const world = new pixi.Container();
        const back = new pixi.Graphics();
        const shapes = new pixi.Graphics();
        const particles = new pixi.Graphics();
        const overlay = new pixi.Graphics();
        const projectile = new pixi.Sprite();
        projectile.anchor.set(0.5);
        projectile.visible = false;
        const effect = new pixi.Sprite();
        effect.anchor.set(0.5);
        effect.visible = false;
        const side = (visual: Visual, key: string): Side => {
          const created: Side = { sprite: new pixi.Sprite(), flash: new pixi.Sprite(), frames: null, frameTime: 0, candidate: visual.candidate, key, entrance: 0, entranceBurst: false, hidden: false, baseScale: 1 };
          created.flash.blendMode = "add";
          created.flash.alpha = 0;
          applyVisual(created, visual);
          return created;
        };
        const sides = { attacker: side(attackerVisual, props.attacker.throwId), defender: side(defenderVisual, props.defender.throwId) };
        // 위쪽(방어) 포켓몬을 먼저 그려 아래쪽(공격) 포켓몬이 앞에 오게 한다.
        world.addChild(back, sides.defender.sprite, sides.defender.flash, sides.attacker.sprite, sides.attacker.flash, shapes, projectile, effect, particles);
        app.stage.addChild(world, overlay);

        const scene: Scene = {
          pixi, app, world, back, shapes, particles, overlay, projectile, effect, sheets: new Map(), sides, pool: [], typeTextures: new Map(), quality,
          phase: props.phase, actor: props.actor, duration: props.duration, multiplier: props.multiplier, winner: props.winner,
          types: { attacker: props.attacker.battleType, defender: props.defender.battleType },
          stepKey: props.stepKey, elapsed: 0, clock: 0, speed: props.speed, paused: props.paused, burstDone: false, emitDebt: 0, bolt: { at: -1, points: [] },
        };
        sceneRef.current = scene;
        for (const type of new Set([props.attacker.battleType, props.defender.battleType])) loadTypeAssets(scene, type);
        app.ticker.add((ticker) => { if (!scene.paused) update(scene, Math.min(ticker.deltaMS, 50)); });
        if (props.paused) update(scene, 0);
        setPaused(scene, props.paused);
      } catch {
        if (!cancelled) latest.current.onUnavailable();
      }
    }

    void mount();
    return () => {
      cancelled = true;
      sceneRef.current = null;
      try {
        app?.destroy(true, { children: true });
      } catch {
        // init 도중 해제되면 Pixi 내부 상태가 반쯤 만들어져 있을 수 있다.
      }
    };
  }, []);

  // 교대: 새 포켓몬 텍스처를 불러와 몬스터볼 등장 연출을 시작한다.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    let cancelled = false;
    for (const [key, pokemon] of [["attacker", attacker], ["defender", defender]] as const) {
      const side = scene.sides[key];
      scene.types[key] = pokemon.battleType;
      loadTypeAssets(scene, pokemon.battleType);
      if (side.key === pokemon.throwId) continue;
      side.key = pokemon.throwId;
      side.hidden = true;
      loadVisual(scene.pixi, pokemon.imagePath, key).then((visual) => {
        if (cancelled || sceneRef.current !== scene || side.key !== pokemon.throwId) return;
        applyVisual(side, visual);
        startEntrance(side);
      }, () => { if (!cancelled) latest.current.onUnavailable(); });
    }
    return () => { cancelled = true; };
  }, [attacker, defender]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || scene.stepKey === stepKey) return;
    // 회수 단계가 끝나면 쓰러진 쪽은 다음 등장 전까지 숨긴다.
    if (scene.phase === "recall" && scene.actor) scene.sides[scene.actor].hidden = true;
    Object.assign(scene, { phase, actor, duration, multiplier, winner, stepKey, elapsed: 0, burstDone: false, emitDebt: 0 });
  }, [actor, duration, multiplier, phase, stepKey, winner]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !replayKey) return;
    scene.pool.length = 0;
    startEntrance(scene.sides.attacker);
    startEntrance(scene.sides.defender);
  }, [replayKey]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (scene) scene.speed = speed;
  }, [speed]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    setPaused(scene, paused);
  }, [paused]);

  return <div ref={hostRef} className="absolute inset-0" aria-hidden />;
}

// 일시정지 중에는 장면 시계를 멈추고, 멈춘 화면만 낮은 빈도로 다시 그린다.
function setPaused(scene: Scene, paused: boolean) {
  scene.paused = paused;
  scene.app.ticker.maxFPS = paused ? 10 : 0;
}

function startEntrance(side: Side) {
  side.entrance = 0;
  side.entranceBurst = false;
  side.hidden = false;
}

/** 외부 스프라이트를 우선순위대로 시도하고, 모두 실패하면 예외를 던진다(호출부가 DOM 로그로 전환). */
async function loadVisual(pixi: Pixi, imagePath: string, side: SideKey): Promise<Visual> {
  for (const candidate of battleSpriteCandidates(imagePath, side)) {
    try {
      const asset = await pixi.Assets.load(candidate.url);
      const frames = candidate.animated && Array.isArray(asset?.frames) && asset.frames.length ? asset.frames as GifFrame[] : null;
      const texture = frames ? frames[0].texture : asset as import("pixi.js").Texture;
      for (const item of frames?.map((frame) => frame.texture) ?? [texture]) item.source.scaleMode = "nearest";
      return { texture, frames, candidate };
    } catch {
      // 다음 후보로 내려간다.
    }
  }
  throw new Error("pokemon sprite unavailable");
}

function applyVisual(side: Side, visual: Visual) {
  side.frames = visual.frames;
  side.frameTime = 0;
  side.candidate = visual.candidate;
  for (const sprite of [side.sprite, side.flash]) {
    sprite.texture = visual.texture;
    sprite.anchor.set(0.5, visual.candidate.anchorY);
  }
}

function loadSheet(scene: Scene, sheet: EffectSheet | undefined) {
  if (!sheet || scene.sheets.has(sheet.url)) return;
  scene.sheets.set(sheet.url, null);
  scene.pixi.Assets.load(sheet.url).then((base: import("pixi.js").Texture) => {
    base.source.scaleMode = "nearest";
    const frames = sheet.frames.map((frame) => {
      const cell = effectCell(frame);
      return new scene.pixi.Texture({ source: base.source, frame: new scene.pixi.Rectangle(cell.x, cell.y, cell.width, cell.height) });
    });
    scene.sheets.set(sheet.url, frames);
  }, () => {
    // 외부 이펙트 시트는 장식이므로 실패하면 Graphics 연출만 쓴다.
  });
}

/** 시트가 준비됐으면 경과 시간에 맞는 프레임을 돌려준다. */
function sheetFrame(scene: Scene, sheet: EffectSheet | undefined, time: number, loop: boolean) {
  const frames = sheet ? scene.sheets.get(sheet.url) : null;
  if (!sheet || !frames?.length) return null;
  const index = Math.floor(time / sheet.frameMs);
  if (!loop && index >= frames.length) return null;
  return frames[index % frames.length];
}

function loadTypeAssets(scene: Scene, type: string) {
  const effect = battleEffect(type);
  const sheets = BATTLE_EFFECT_SHEETS[effect.motion];
  loadSheet(scene, sheets.projectile);
  loadSheet(scene, sheets.impact);
  const path = effect.spritePath;
  if (scene.typeTextures.has(path)) return;
  scene.typeTextures.set(path, null);
  scene.pixi.Assets.load(path).then((texture: import("pixi.js").Texture) => {
    texture.source.scaleMode = "nearest";
    scene.typeTextures.set(path, texture);
  }, () => {
    // 타입 이펙트 이미지는 장식이므로 실패하면 도형 연출만 쓴다.
  });
}

function emit(scene: Scene, count: number, make: (index: number) => Omit<Particle, "life" | "angle"> & { angle?: number }) {
  const total = Math.max(1, Math.round(count * scene.quality.particleScale));
  for (let index = 0; index < total && scene.pool.length < scene.quality.maxParticles; index++) {
    const particle = make(index);
    scene.pool.push({ ...particle, life: 0, angle: particle.angle ?? Math.random() * Math.PI * 2 });
  }
}

/** 초당 rate개를 시간에 비례해 뿜는다. */
function stream(scene: Scene, delta: number, rate: number, make: Parameters<typeof emit>[2]) {
  scene.emitDebt += rate * delta / 1_000;
  const count = Math.floor(scene.emitDebt);
  if (count <= 0) return;
  scene.emitDebt -= count;
  for (let index = 0; index < count && scene.pool.length < scene.quality.maxParticles; index++) {
    if (scene.quality.compact && index % 2) continue;
    const particle = make(index);
    scene.pool.push({ ...particle, life: 0, angle: particle.angle ?? Math.random() * Math.PI * 2 });
  }
}

const random = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

function burst(scene: Scene, x: number, y: number, motion: BattleMotion, palette: BattlePalette, profile: ImpactProfile, shards: boolean) {
  const count = 22 * profile.burst;
  const colors = [palette[1], palette[2], palette[3]];
  if (motion === "flame") emit(scene, count, () => { const a = random(-Math.PI, 0); const s = random(60, 220) * profile.burst; return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, gravity: -120, drag: 2.2, maxLife: random(380, 700), size: random(3, 7), color: pick([palette[0], palette[1], palette[2]]), shape: "dot", spin: 0 }; });
  if (motion === "splash") emit(scene, count, () => { const a = random(-Math.PI * 0.95, -Math.PI * 0.05); const s = random(90, 240) * profile.burst; return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, gravity: 620, drag: 0.6, maxLife: random(450, 750), size: random(2.5, 5), color: pick(colors), shape: shards ? pick(["diamond", "dot"] as const) : "dot", spin: random(-6, 6) }; });
  if (motion === "bolt") emit(scene, count, () => { const a = random(0, Math.PI * 2); const s = random(160, 380) * profile.burst; return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, gravity: 0, drag: 5, maxLife: random(200, 380), size: random(6, 12), color: pick([palette[1], palette[2], "#ffffff"]), shape: "spark", spin: 0 }; });
  if (motion === "leaf") emit(scene, count, () => { const a = random(0, Math.PI * 2); const s = random(70, 200) * profile.burst; return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, gravity: 90, drag: 2, maxLife: random(500, 850), size: random(4, 7), color: pick([palette[0], palette[1], palette[2]]), shape: "diamond", spin: random(-10, 10) }; });
  if (motion === "strike") emit(scene, count, (index) => { const a = random(0, Math.PI * 2); const s = random(120, 280) * profile.burst; return index % 3 === 0 ? { x, y: y + 30, vx: random(-90, 90), vy: random(-60, -10), gravity: 160, drag: 2.5, maxLife: random(400, 650), size: random(3, 5), color: palette[0], shape: "pixel", spin: 0 } : { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, gravity: 0, drag: 4, maxLife: random(220, 420), size: random(3, 6), color: pick(colors), shape: index % 4 === 1 ? "star" : "pixel", spin: random(-8, 8) }; });
  if (motion === "wave") emit(scene, count, () => { const a = random(0, Math.PI * 2); const s = random(50, 160) * profile.burst; return { x: x + Math.cos(a) * 12, y: y + Math.sin(a) * 12, vx: Math.cos(a) * s, vy: Math.sin(a) * s, gravity: -30, drag: 1.6, maxLife: random(500, 900), size: random(2.5, 5), color: pick(colors), shape: pick(["dot", "star"] as const), spin: random(-4, 4) }; });
}

function update(scene: Scene, rawDelta: number) {
  const { app, world, back, shapes, particles, overlay, projectile, sides } = scene;
  const width = app.screen.width;
  const height = app.screen.height;
  const delta = rawDelta * scene.speed;
  const size = Math.min(112, height * 0.4, width * 0.3);
  const home: Record<SideKey, { x: number; y: number }> = {
    attacker: { x: width * 0.25, y: height * 0.64 + size * 0.32 },
    defender: { x: width * 0.75, y: height * 0.42 + size * 0.32 },
  };
  const center = (key: SideKey) => ({ x: home[key].x, y: home[key].y - size * 0.34 });
  const { phase, actor } = scene;
  const source: SideKey = actor === "defender" ? "defender" : "attacker";
  const targetKey: SideKey = source === "attacker" ? "defender" : "attacker";
  const effect = battleEffect(scene.types[source]);
  const palette = effect.palette;
  const profile = impactProfile(scene.multiplier);
  const progress = clamp01(scene.elapsed / Math.max(scene.duration, 1));
  const impactLocal = phase === "impact" ? Math.max(0, scene.elapsed - profile.hitstop) : 0;
  const impactProgress = phase === "impact" ? clamp01(impactLocal / Math.max(scene.duration - profile.hitstop, 1)) : 0;
  const hitstop = phase === "impact" && scene.elapsed < profile.hitstop;

  // 히트스톱 동안에는 대기 모션과 파티클도 멈춘다.
  scene.elapsed += delta;
  if (!hitstop) scene.clock += delta;
  for (const side of Object.values(sides)) {
    if (side.entrance !== null) side.entrance += delta;
    // 애니메이션 GIF는 장면 시계로 프레임을 넘겨 일시정지·히트스톱·배속을 함께 따른다.
    if (side.frames && !hitstop) {
      side.frameTime = (side.frameTime + delta) % Math.max(side.frames.at(-1)!.end, 1);
      const frame = side.frames.find((item) => side.frameTime >= item.start && side.frameTime < item.end) ?? side.frames[0];
      side.sprite.texture = frame.texture;
      side.flash.texture = frame.texture;
    }
  }

  back.clear();
  shapes.clear();
  particles.clear();
  overlay.clear();
  projectile.visible = false;
  scene.effect.visible = false;

  const offsets: Record<SideKey, { x: number; y: number; sx: number; sy: number; alpha: number; flash: number; tint: number; flashTint: number }> = {
    attacker: { x: 0, y: 0, sx: 1, sy: 1, alpha: 1, flash: 0, tint: 0xffffff, flashTint: 0xffffff },
    defender: { x: 0, y: 0, sx: 1, sy: 1, alpha: 1, flash: 0, tint: 0xffffff, flashTint: 0xffffff },
  };

  // 대기: 가벼운 호흡과 바운스
  (["attacker", "defender"] as const).forEach((key, index) => {
    if ((phase === "recall" && actor === key) || (phase === "result" && scene.winner !== key)) return;
    // 약 1.8초 주기, 2~3px 상하 움직임
    const breath = Math.sin(scene.clock / 290 + index * 1.7);
    offsets[key].y -= (breath + 1) * 1.25;
    offsets[key].sy += breath * 0.025;
    offsets[key].sx -= breath * 0.012;
  });

  // 등장: 몬스터볼 투척 → 섬광 → 포켓몬
  (["attacker", "defender"] as const).forEach((key) => {
    const side = sides[key];
    if (side.entrance === null) return;
    const t = clamp01(side.entrance / ENTRANCE_MS);
    const target = center(key);
    const start = key === "attacker" ? { x: -24, y: height * 0.92 } : { x: width + 24, y: height * 0.08 };
    if (t < BALL_OPEN) {
      const p = easeOutCubic(t / BALL_OPEN);
      const x = lerp(start.x, target.x, p);
      const y = lerp(start.y, target.y, p) - Math.sin(p * Math.PI) * height * 0.22;
      drawBall(shapes, x, y, 10, t * 26 * (key === "attacker" ? 1 : -1));
      offsets[key].alpha = 0;
    } else {
      if (!side.entranceBurst) {
        side.entranceBurst = true;
        emit(scene, 18, () => { const a = random(0, Math.PI * 2); const s = random(80, 200); return { x: target.x, y: target.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, gravity: 0, drag: 3.5, maxLife: random(300, 520), size: random(2, 4), color: pick(["#ffffff", "#dbeafe", "#fef9c3"]), shape: pick(["pixel", "star"] as const), spin: random(-6, 6) }; });
      }
      const open = segment(t, BALL_OPEN, BALL_OPEN + 0.22);
      shapes.circle(target.x, target.y, 8 + open * size * 0.7).fill({ color: 0xffffff, alpha: (1 - open) * 0.85 });
      const grow = easeOutBack(segment(t, BALL_OPEN, 0.9));
      offsets[key].sx *= grow;
      offsets[key].sy *= grow;
      offsets[key].flash = 1 - segment(t, BALL_OPEN + 0.1, 1);
    }
    if (t >= 1) side.entrance = null;
  });

  // 차징: 타입 색 기운이 모여든다.
  if (phase === "charge" && actor) {
    const from = center(source);
    const pulse = 0.5 + Math.sin(scene.elapsed / 45) * 0.5;
    shapes.circle(from.x, from.y, size * (0.42 + pulse * 0.08)).fill({ color: palette[1], alpha: 0.14 + progress * 0.12 });
    shapes.circle(from.x, from.y, size * (0.5 + pulse * 0.06)).stroke({ width: 2, color: palette[2], alpha: 0.6 * progress });
    stream(scene, delta, 70, () => { const a = random(0, Math.PI * 2); const r = size * random(0.6, 0.9); return { x: from.x + Math.cos(a) * r, y: from.y + Math.sin(a) * r, vx: -Math.cos(a) * r * 3.2, vy: -Math.sin(a) * r * 3.2, gravity: 0, drag: 0, maxLife: 280, size: random(2, 4), color: pick([palette[1], palette[2], palette[3]]), shape: "pixel", spin: 0 }; });
    offsets[source].sy *= 1 - progress * 0.08;
    offsets[source].sx *= 1 + progress * 0.05;
    offsets[source].flash = progress * 0.45;
    offsets[source].flashTint = colorNumber(palette[1]);
  }

  // 공격: 계열별 투사체
  if (phase === "attack" && actor) {
    const from = center(source);
    const to = center(targetKey);
    const direction = to.x > from.x ? 1 : -1;
    const p = easeInCubic(progress) * 0.35 + progress * 0.65;
    const lunge = Math.sin(clamp01(progress * 1.6) * Math.PI);
    offsets[source].x += direction * lunge * (effect.motion === "strike" ? size * 0.55 : 12);
    offsets[source].y -= lunge * (effect.motion === "strike" ? 10 : 3);
    drawProjectile(scene, delta, effect.motion, palette, effect.spritePath, from, to, p, direction, size);
  }

  // 피격: 히트스톱 → 흰색 플래시 → 넉백·카메라 흔들림
  let shake = 0;
  let punch = 0;
  if (phase === "impact" && actor) {
    const to = center(targetKey);
    const direction = to.x > center(source).x ? 1 : -1;
    if (hitstop) {
      offsets[targetKey].flash = 1;
      offsets[targetKey].x += direction * 3;
      const texture = scene.typeTextures.get(effect.spritePath);
      if (texture) placeProjectile(projectile, texture, to.x - direction * 10, to.y, direction, 40);
      if (profile.screenFlash) overlay.rect(0, 0, width, height).fill({ color: 0xffffff, alpha: profile.screenFlash });
    } else {
      if (!scene.burstDone) {
        scene.burstDone = true;
        burst(scene, to.x, to.y, effect.motion, palette, profile, scene.types[source] === "ice");
      }
      const ip = impactProgress;
      const knock = easeOutCubic(segment(ip, 0, 0.18)) * (1 - segment(ip, 0.3, 1)) * profile.knockback;
      offsets[targetKey].x += direction * knock;
      offsets[targetKey].x += ip < 0.35 ? (Math.random() - 0.5) * 6 * profile.burst : 0;
      offsets[targetKey].flash = ip < 0.4 ? (Math.floor(ip * 20) % 2 ? 0.85 : 0.1) : 0;
      offsets[targetKey].sx *= 1 - Math.sin(segment(ip, 0, 0.3) * Math.PI) * 0.08;
      drawImpact(shapes, effect.motion, palette, to.x, to.y, ip, size, profile);
      const impactSheet = BATTLE_EFFECT_SHEETS[effect.motion].impact;
      const frame = sheetFrame(scene, impactSheet, impactLocal, false) ?? (impactSheet?.frames.length === 1 && ip < 0.5 ? sheetFrame(scene, impactSheet, 0, false) : null);
      if (frame) {
        const pop = impactSheet?.frames.length === 1 ? easeOutBack(segment(ip, 0, 0.25)) * (1 - segment(ip, 0.35, 0.5)) : 1;
        placeProjectile(scene.effect, frame, to.x, to.y, direction, size * 1.4 * Math.sqrt(profile.burst) * pop);
      }
      shake = profile.shake * (1 - segment(ip, 0, 0.55)) ** 2;
      punch = profile.tier === "strong" ? 0.035 * (1 - segment(ip, 0, 0.4)) : 0;
    }
  }

  // 기절·회수: 회색으로 쓰러져 가라앉은 뒤 붉은 빛으로 회수
  if (phase === "recall" && actor) {
    const fall = easeInCubic(segment(progress, 0.05, 0.6));
    const fade = segment(progress, 0.55, 1);
    offsets[actor].tint = 0x6b7280;
    offsets[actor].y += fall * size * 0.32;
    offsets[actor].sy *= 1 - fall * 0.25;
    offsets[actor].alpha = 1 - fade;
    offsets[actor].flash = fade * 0.9;
    offsets[actor].flashTint = 0xff5a5f;
    offsets[actor].sx *= 1 - fade * 0.6;
    if (fade > 0) {
      const at = center(actor);
      const ball = actor === "attacker" ? { x: width * 0.06, y: height * 0.86 } : { x: width * 0.94, y: height * 0.12 };
      shapes.moveTo(ball.x, ball.y).lineTo(at.x, at.y + size * 0.2).stroke({ width: 3, color: 0xff5a5f, alpha: (1 - fade) * 0.9 });
      drawBall(shapes, ball.x, ball.y, 9, 0);
    }
  }

  // 결과: 승리 측이 뛰어오르며 반짝인다.
  if (phase === "result") {
    const loser: SideKey = scene.winner === "attacker" ? "defender" : "attacker";
    offsets[loser].alpha = 0;
    const hop = Math.abs(Math.sin(scene.clock / 240));
    offsets[scene.winner].y -= hop * 16;
    offsets[scene.winner].sy *= hop < 0.15 ? 0.92 : 1.02;
    offsets[scene.winner].flash = 0.12 + Math.sin(scene.clock / 160) * 0.08;
    offsets[scene.winner].flashTint = 0xfacc15;
    const at = center(scene.winner);
    const glow = 0.5 + Math.sin(scene.clock / 200) * 0.5;
    back.ellipse(home[scene.winner].x, home[scene.winner].y, size * (0.5 + glow * 0.08), size * 0.14).fill({ color: 0xfff7c2, alpha: 0.35 }).stroke({ width: 3, color: 0xfacc15, alpha: 0.6 + glow * 0.4 });
    stream(scene, delta, 16, () => ({ x: at.x + random(-size * 0.5, size * 0.5), y: at.y + random(-size * 0.2, size * 0.4), vx: random(-12, 12), vy: random(-70, -30), gravity: 0, drag: 0.5, maxLife: random(700, 1_100), size: random(3, 5), color: pick(["#facc15", "#fef08a", "#ffffff"]), shape: "star", spin: random(-3, 3) }));
  }

  // 포켓몬과 바닥 그림자
  (["attacker", "defender"] as const).forEach((key) => {
    const side = sides[key];
    const offset = offsets[key];
    const visible = !side.hidden || side.entrance !== null || (phase === "recall" && actor === key);
    const alpha = visible ? offset.alpha : 0;
    // 꼭 맞게 잘린 GIF는 픽셀 배율을, 여백 있는 96px PNG는 폭 기준 배율을 쓴다.
    side.baseScale = side.frames ? Math.min(size / 96 * 1.5, size * 1.3 / Math.max(side.sprite.texture.height, 1)) : size / Math.max(side.sprite.texture.width, 1);
    const facing = side.candidate.flip ? -1 : 1;
    const x = home[key].x + offset.x;
    const y = home[key].y + offset.y;
    for (const sprite of [side.sprite, side.flash]) {
      sprite.position.set(x, y);
      sprite.scale.set(facing * side.baseScale * offset.sx, side.baseScale * offset.sy);
    }
    side.sprite.alpha = alpha;
    side.sprite.tint = offset.tint;
    side.flash.alpha = alpha > 0 ? clamp01(offset.flash) : 0;
    side.flash.tint = offset.flashTint;
    const lift = clamp01((home[key].y - y) / 40);
    if (alpha > 0) back.ellipse(home[key].x + offset.x * 0.6, home[key].y - 2, size * 0.32 * Math.max(offset.sx, 0.2) * (1 - lift * 0.3), size * 0.07).fill({ color: 0x0f172a, alpha: 0.28 * alpha * (1 - lift * 0.4) });
  });

  // 파티클
  const seconds = hitstop ? 0 : delta / 1_000;
  scene.pool = scene.pool.filter((particle) => {
    particle.life += hitstop ? 0 : delta;
    if (particle.life >= particle.maxLife) return false;
    particle.vx *= Math.max(0, 1 - particle.drag * seconds);
    particle.vy = particle.vy * Math.max(0, 1 - particle.drag * seconds) + particle.gravity * seconds;
    particle.x += particle.vx * seconds;
    particle.y += particle.vy * seconds;
    particle.angle += particle.spin * seconds;
    drawParticle(particles, particle);
    return true;
  });

  // 카메라
  world.pivot.set(width / 2, height / 2);
  world.position.set(width / 2 + (shake ? (Math.random() - 0.5) * 2 * shake : 0), height / 2 + (shake ? (Math.random() - 0.5) * 2 * shake : 0));
  world.scale.set(1 + punch);
}

function drawProjectile(scene: Scene, delta: number, motion: BattleMotion, palette: BattlePalette, spritePath: string, from: { x: number; y: number }, to: { x: number; y: number }, p: number, direction: number, size: number) {
  const { shapes, projectile } = scene;
  const texture = scene.typeTextures.get(spritePath);
  const x = lerp(from.x, to.x, p);
  const arc = motion === "flame" ? -Math.sin(p * Math.PI) * size * 0.25 : 0;
  const y = lerp(from.y, to.y, p) + arc;

  if (motion === "bolt") {
    // 번개: 지그재그 줄기가 대상까지 뻗는다(45ms마다 새로 꺾인다).
    const reach = clamp01(p * 1.5);
    const tipX = lerp(from.x, to.x, reach);
    const tipY = lerp(from.y, to.y, reach);
    if (scene.elapsed - scene.bolt.at > 45 || scene.bolt.at < 0) {
      scene.bolt.at = scene.elapsed;
      scene.bolt.points = Array.from({ length: 9 }, (_, index) => index === 0 || index === 8 ? 0 : random(-1, 1));
    }
    const dx = tipX - from.x;
    const dy = tipY - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const points = scene.bolt.points.map((jitter, index) => {
      const t = index / 8;
      return [from.x + dx * t + nx * jitter * 16, from.y + dy * t + ny * jitter * 16] as const;
    });
    for (const [widthPx, color, alpha] of [[10, palette[0], 0.45], [5, palette[1], 1], [2, "#ffffff", 1]] as const) {
      shapes.moveTo(points[0][0], points[0][1]);
      for (const [px, py] of points.slice(1)) shapes.lineTo(px, py);
      shapes.stroke({ width: widthPx, color, alpha });
    }
    shapes.circle(tipX, tipY, 8 + Math.random() * 4).fill({ color: palette[3], alpha: 0.9 });
    return;
  }

  if (motion === "wave") {
    // 파동: 흔들리는 고리 여러 겹이 날아간다.
    for (let ring = 0; ring < 3; ring++) {
      const lag = clamp01(p - ring * 0.12);
      const rx = lerp(from.x, to.x, lag);
      const ry = lerp(from.y, to.y, lag) + Math.sin(scene.elapsed / 40 + ring) * 5;
      shapes.circle(rx, ry, 10 + ring * 5 + Math.sin(scene.elapsed / 60 + ring) * 2).stroke({ width: 3 - ring * 0.6, color: ring ? palette[1] : palette[2], alpha: 0.9 - ring * 0.25 });
    }
    shapes.circle(x, y, 7).fill({ color: palette[3], alpha: 0.9 });
  }

  if (motion === "leaf") {
    // 잎사귀·바람: 나선을 그리며 날아가는 조각들
    for (let leaf = 0; leaf < 5; leaf++) {
      const lag = clamp01(p - leaf * 0.06);
      const angle = scene.elapsed / 70 + leaf * 1.3;
      const lx = lerp(from.x, to.x, lag) + Math.cos(angle) * 12;
      const ly = lerp(from.y, to.y, lag) + Math.sin(angle) * 12;
      diamond(shapes, lx, ly, 6, angle, leaf % 2 ? palette[1] : palette[2], 0.95);
    }
  }

  if (motion === "strike") {
    // 몸통 박치기: 돌진선과 충격 별
    for (let line = 0; line < 4; line++) {
      const ly = y - 12 + line * 8;
      shapes.moveTo(x - direction * (18 + line * 6), ly).lineTo(x - direction * (44 + line * 10), ly).stroke({ width: 2, color: palette[2], alpha: 0.7 });
    }
  }

  if (motion === "flame") {
    stream(scene, delta, 90, () => ({ x: x + random(-5, 5), y: y + random(-5, 5), vx: -direction * random(20, 70), vy: random(-60, -20), gravity: -80, drag: 1.5, maxLife: random(220, 420), size: random(3, 6), color: pick([palette[0], palette[1], palette[2]]), shape: "dot", spin: 0 }));
  }
  if (motion === "splash") {
    stream(scene, delta, 70, () => ({ x: x + random(-6, 6), y: y + random(-6, 6), vx: -direction * random(10, 40), vy: random(-20, 20), gravity: 120, drag: 1, maxLife: random(260, 460), size: random(2, 4), color: pick([palette[1], palette[2], palette[3]]), shape: "dot", spin: 0 }));
  }

  const sheetTexture = sheetFrame(scene, BATTLE_EFFECT_SHEETS[motion].projectile, scene.elapsed, true);
  if (sheetTexture) placeProjectile(projectile, sheetTexture, x, y, direction, size * 1.1);
  else if (texture) placeProjectile(projectile, texture, x, y, motion === "splash" && spritePath.includes("water") ? -direction : direction, motion === "strike" ? 38 : 46);
  else if (motion !== "wave") {
    shapes.circle(x, y, 16).fill({ color: palette[1], alpha: 0.35 });
    shapes.circle(x, y, 10).fill({ color: palette[1] });
    shapes.circle(x, y, 4).fill({ color: palette[3] });
  }
}

function drawImpact(g: import("pixi.js").Graphics, motion: BattleMotion, palette: BattlePalette, x: number, y: number, ip: number, size: number, profile: ImpactProfile) {
  const scale = profile.burst;
  const ring = easeOutCubic(segment(ip, 0, 0.6));
  const fade = 1 - segment(ip, 0.1, 0.7);
  if (fade <= 0) return;
  g.circle(x, y, (12 + ring * size * 0.45) * scale).stroke({ width: 3 * scale, color: palette[2], alpha: fade });
  if (motion === "strike") g.star(x, y, 8, (10 + ring * 26) * scale, (5 + ring * 10) * scale, ip * 2).fill({ color: palette[3], alpha: fade });
  if (motion === "flame") g.circle(x, y, (14 + ring * 24) * scale).fill({ color: palette[1], alpha: fade * 0.55 });
  if (motion === "splash") g.ellipse(x, y + size * 0.3, (10 + ring * 40) * scale, (3 + ring * 8) * scale).stroke({ width: 2, color: palette[1], alpha: fade });
  if (motion === "bolt" && ip < 0.5) {
    for (let arm = 0; arm < 5; arm++) {
      const angle = Math.random() * Math.PI * 2;
      const mid = 10 + Math.random() * 10;
      g.moveTo(x, y).lineTo(x + Math.cos(angle + 0.4) * mid, y + Math.sin(angle + 0.4) * mid).lineTo(x + Math.cos(angle) * 30 * scale, y + Math.sin(angle) * 30 * scale).stroke({ width: 2, color: palette[2], alpha: fade });
    }
  }
  if (motion === "leaf") g.circle(x, y, (8 + ring * 18) * scale).fill({ color: palette[2], alpha: fade * 0.4 });
  if (motion === "wave") for (let extra = 1; extra < 3; extra++) {
    const r = easeOutCubic(segment(ip, extra * 0.12, 0.6 + extra * 0.12));
    g.circle(x, y, (8 + r * size * 0.5) * scale).stroke({ width: 2, color: palette[1], alpha: (1 - r) * 0.8 });
  }
  g.circle(x, y, (10 + ring * 8) * scale).fill({ color: 0xffffff, alpha: fade * 0.75 });
}

function placeProjectile(sprite: import("pixi.js").Sprite, texture: import("pixi.js").Texture, x: number, y: number, direction: number, sizePx: number) {
  sprite.texture = texture;
  sprite.visible = true;
  sprite.position.set(x, y);
  const scale = sizePx / Math.max(texture.width, 1);
  sprite.scale.set(direction * scale, scale);
}

function drawBall(g: import("pixi.js").Graphics, x: number, y: number, radius: number, rotation: number) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  g.circle(x, y, radius + 1.5).fill({ color: 0x1f2937 });
  g.moveTo(x, y).arc(x, y, radius, rotation + Math.PI, rotation + Math.PI * 2).closePath().fill({ color: 0xef4444 });
  g.moveTo(x, y).arc(x, y, radius, rotation, rotation + Math.PI).closePath().fill({ color: 0xf8fafc });
  g.moveTo(x - cos * radius, y - sin * radius).lineTo(x + cos * radius, y + sin * radius).stroke({ width: 1.5, color: 0x1f2937 });
  g.circle(x, y, radius * 0.32).fill({ color: 0xf8fafc }).stroke({ width: 1, color: 0x1f2937 });
}

function diamond(g: import("pixi.js").Graphics, x: number, y: number, size: number, angle: number, color: string, alpha: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const long = size;
  const short = size * 0.45;
  g.poly([x + cos * long, y + sin * long, x - sin * short, y + cos * short, x - cos * long, y - sin * long, x + sin * short, y - cos * short]).fill({ color, alpha });
}

function drawParticle(g: import("pixi.js").Graphics, particle: Particle) {
  const alpha = 1 - particle.life / particle.maxLife;
  const size = particle.size * (0.6 + alpha * 0.4);
  if (particle.shape === "dot") g.circle(particle.x, particle.y, size / 2).fill({ color: particle.color, alpha });
  else if (particle.shape === "pixel") g.rect(Math.round(particle.x - size / 2), Math.round(particle.y - size / 2), size, size).fill({ color: particle.color, alpha });
  else if (particle.shape === "diamond") diamond(g, particle.x, particle.y, size, particle.angle, particle.color, alpha);
  else if (particle.shape === "star") g.star(particle.x, particle.y, 4, size, size * 0.4, particle.angle).fill({ color: particle.color, alpha });
  else {
    const speed = Math.hypot(particle.vx, particle.vy) || 1;
    g.moveTo(particle.x, particle.y).lineTo(particle.x - particle.vx / speed * size, particle.y - particle.vy / speed * size).stroke({ width: 2, color: particle.color, alpha });
  }
}

function colorNumber(hex: string) {
  return Number.parseInt(hex.slice(1), 16);
}
