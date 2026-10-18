"use client";

import { useEffect, useRef } from "react";
import type { RankingPokemon } from "@/lib/pokedex/ranking-league";
import { battleEffect, type BattleMotion, type BattlePalette } from "@/lib/pokedex/battle-effects";
import { attackSoundUrl, battleArena, effectSheetsFor, MOVE_FRAME_MS, moveAnimUrl, moveGraphicUrl, moveSoundUrl, battleSpriteCandidates, effectCell, FIELD, FIELD_SPOTS, particleBoxes, POKEBALL_PARTICLES, POKEBALL_SPRITES, POKEMON_SPRITE_FRAME_MS, type EffectSheet, type SpriteCandidate } from "./ranking-battle-assets";
import { hasTone, interpolateFrame, parseMoveAnim, placeMoveElement, toneMatrix, type MoveAnim, type MoveAnimSet } from "./ranking-move-anim";
import { clamp01, easeInCubic, easeOutBack, easeOutCubic, impactProfile, lerp, sceneQuality, segment, type ImpactProfile } from "./ranking-battle-fx";

export type RankingScenePhase = "intro" | "sendout" | "charge" | "attack" | "impact" | "recall" | "result";
type SideKey = "attacker" | "defender";
type Pixi = typeof import("pixi.js");

const ENTRANCE_MS = 820;
/** 장면 그리는 순서(zIndex) */
const Z = { background: 0, bases: 1, shadows: 2, moveBackground: 3, defender: 10, attacker: 20, effects: 25, moveTop: 30, particles: 40 } as const;
const BALL_OPEN = 0.46;
/** 선공 결정: 양쪽 몬스터볼이 맞부딪친 뒤 선공 쪽 볼이 떠오르는 시간(장면 시간 ms) */
export const TOSS_MS = 1_150;
const TOSS_CLASH = 0.42;
type BallState = keyof typeof POKEBALL_SPRITES;

type Particle = {
  x: number; y: number; vx: number; vy: number; gravity: number; drag: number;
  life: number; maxLife: number; size: number; color: string; shape: "dot" | "pixel" | "diamond" | "spark" | "star"; spin: number; angle: number;
};

type GifFrame = { texture: import("pixi.js").Texture; start: number; end: number };
type Visual = { texture: import("pixi.js").Texture; frames: GifFrame[] | null; candidate: SpriteCandidate };
type SheetFrames = import("pixi.js").Texture[];

/** 몬스터볼 방출 파티클(PokéRogue 아틀라스 스프라이트) */
type Spark = { sprite: import("pixi.js").Sprite; x: number; y: number; vx: number; vy: number; life: number; maxLife: number; spin: number; scale: number };

/** 불러온 PokéRogue 기술: 원본 JSON과 이펙트 시트, 잘라 둔 셀 */
type Sheet = { base: import("pixi.js").Texture; cells: Map<number, import("pixi.js").Texture | null> };
type MoveEntry = { set: MoveAnimSet; main: Sheet; opponent: Sheet | null; backgrounds: Map<string, import("pixi.js").Texture> };
/** 기술이 깐 타일 배경과 진행 중인 위치·투명도 변화(PokéRogue 배경 이벤트) */
type MoveBackground = { sprite: import("pixi.js").TilingSprite | import("pixi.js").Sprite; tweens: Partial<Record<"x" | "y" | "alpha", { from: number; to: number; start: number; duration: number }>> };
/** 재생 중인 기술. 상대 전용 변형을 쓰면 PokéRogue처럼 애니메이션의 시전자·대상 자리를 맞바꾼다. */
type ActiveMove = { name: string; anim: MoveAnim; sheet: Sheet; entry: MoveEntry; clock: number; fired: Set<number>; firedBackgrounds: Set<number>; animUser: SideKey; animTarget: SideKey };
export type SceneSound = { preload: (url: string) => void; play: (url: string, volume: number, rate?: number) => void };

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
  /** 기술 애니메이션이 준 색조(프레임마다 갱신) */
  tone: readonly [number, number, number, number];
  toneFilter: import("pixi.js").ColorMatrixFilter;
  toneFilters: import("pixi.js").Filter[];
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
  arena: { background: import("pixi.js").Sprite; attackerBase: import("pixi.js").Sprite; defenderBase: import("pixi.js").Sprite };
  balls: import("pixi.js").Sprite[];
  sparks: { textures: import("pixi.js").Texture[]; pool: import("pixi.js").Sprite[]; items: Spark[] };
  moves: Map<string, MoveEntry | null>;
  moveSprites: import("pixi.js").Sprite[];
  move: ActiveMove | null;
  moveBackground: MoveBackground | null;
  sound: () => SceneSound | undefined;
  /** 320×180 필드를 그리는 렌더 텍스처와, 그것을 캔버스 크기로 확대해 보여주는 스프라이트 */
  fieldRoot: import("pixi.js").Container;
  fieldTexture: import("pixi.js").RenderTexture;
  screen: import("pixi.js").Sprite;
  ballIndex: number;
  ballTextures: Partial<Record<BallState, import("pixi.js").Texture>>;
  firstTurn: SideKey | null;
  introEntered: boolean;
  tossBurst: boolean;
  sides: Record<SideKey, Side>;
  pool: Particle[];
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

export function PixiRankingBattleScene({ arenaSeed, firstTurn, teams, attacker, defender, phase, actor, duration, multiplier, winner, stepKey, replayKey, speed, paused, onUnavailable, sound, move, preloadMoves }: {
  /** 배경 선택용 값(전투 id). 같은 기록은 같은 배경을 쓴다. */
  arenaSeed: string;
  /** 저장된 선공. 있으면 intro 단계에서 볼 던지기 선공 연출을 한다. */
  firstTurn: SideKey | null;
  /** 교대 때 바로 보이도록 미리 불러 둘 양측 팀 전체 */
  teams: Record<SideKey, RankingPokemon[]>;
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
  /** 기술 효과음 재생(효과음 꺼짐·일시정지 판단은 호출하는 쪽이 한다) */
  sound?: SceneSound;
  /** 이번 공격 단계에서 재생할 PokéRogue 기술(React가 매 재생마다 무작위로 고른다) */
  move?: string | null;
  /** 이번 재생에서 쓸 기술들(미리 받아 둔다) */
  preloadMoves?: readonly string[];
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const latest = useRef({ arenaSeed, firstTurn, teams, attacker, defender, phase, actor, duration, multiplier, winner, stepKey, speed, paused, onUnavailable, sound, move, preloadMoves });
  latest.current = { arenaSeed, firstTurn, teams, attacker, defender, phase, actor, duration, multiplier, winner, stepKey, speed, paused, onUnavailable, sound, move, preloadMoves };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const target = host;
    let cancelled = false;
    let app: import("pixi.js").Application | null = null;

    async function mount() {
      try {
        const [pixi] = await Promise.all([import("pixi.js"), import("pixi.js/gif")]);
        // 배경·발판·볼은 포켓몬 이미지를 기다리는 동안 미리 받아 둔다(장면이 열리자마자 보이도록).
        const arenaUrls = battleArena(latest.current.arenaSeed);
        void pixi.Assets.load([arenaUrls.background, arenaUrls.attackerBase, arenaUrls.defenderBase, ...Object.values(POKEBALL_SPRITES)]).catch(() => undefined);
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
          const created: Side = { sprite: new pixi.Sprite(), flash: new pixi.Sprite(), frames: null, frameTime: 0, candidate: visual.candidate, key, entrance: 0, entranceBurst: false, hidden: false, baseScale: 1, tone: [0, 0, 0, 0], toneFilter: new pixi.ColorMatrixFilter(), toneFilters: [] };
          created.toneFilters = [created.toneFilter];
          created.flash.blendMode = "add";
          created.flash.alpha = 0;
          applyVisual(created, visual);
          return created;
        };
        const sides = { attacker: side(attackerVisual, props.attacker.throwId), defender: side(defenderVisual, props.defender.throwId) };
        const arena = { background: new pixi.Sprite(), attackerBase: new pixi.Sprite(), defenderBase: new pixi.Sprite() };
        for (const sprite of Object.values(arena)) sprite.visible = false;
        const balls = Array.from({ length: 4 }, () => { const ball = new pixi.Sprite(); ball.anchor.set(0.5); ball.visible = false; return ball; });
        const sparkPool = Array.from({ length: quality.compact ? 24 : 48 }, () => { const spark = new pixi.Sprite(); spark.anchor.set(0.5); spark.visible = false; spark.blendMode = "add"; return spark; });
        const moveSprites = Array.from({ length: 24 }, () => { const sprite = new pixi.Sprite(); sprite.anchor.set(0.5); sprite.visible = false; return sprite; });
        // 그리는 순서(zIndex): 배경 → 발판 → 그림자 → 기술 배경 → 위쪽(방어) 포켓몬 → 아래쪽(공격) 포켓몬 → 연출. 기술 셀은 우선순위에 따라 끼워 넣는다.
        world.sortableChildren = true;
        const layer = (z: number, ...items: import("pixi.js").Container[]) => { for (const item of items) { item.zIndex = z; world.addChild(item); } };
        layer(Z.background, arena.background);
        layer(Z.bases, arena.defenderBase, arena.attackerBase);
        layer(Z.shadows, back);
        layer(Z.defender, sides.defender.sprite);
        layer(Z.defender + 0.1, sides.defender.flash);
        layer(Z.attacker, sides.attacker.sprite);
        layer(Z.attacker + 0.1, sides.attacker.flash);
        layer(Z.effects, shapes, ...balls, ...sparkPool, projectile, effect);
        layer(Z.moveTop, ...moveSprites);
        layer(Z.particles, particles);
        // 장면 전체를 320×180 텍스처에 그린 뒤 최근접 보간으로 확대한다(PokéRogue와 같은 픽셀 밀도).
        const fieldRoot = new pixi.Container();
        fieldRoot.addChild(world, overlay);
        const fieldTexture = pixi.RenderTexture.create({ width: FIELD.width, height: FIELD.height, resolution: 1 });
        fieldTexture.source.scaleMode = "nearest";
        const screen = new pixi.Sprite(fieldTexture);
        app.stage.addChild(screen);

        const scene: Scene = {
          pixi, app, world, back, shapes, particles, overlay, projectile, effect, sheets: new Map(), arena, balls, sparks: { textures: [], pool: sparkPool, items: [] }, moves: new Map(), moveSprites, move: null, moveBackground: null, sound: () => latest.current.sound, fieldRoot, fieldTexture, screen, ballIndex: 0, ballTextures: {}, firstTurn: props.firstTurn, introEntered: false, tossBurst: false, sides, pool: [], quality,
          phase: props.phase, actor: props.actor, duration: props.duration, multiplier: props.multiplier, winner: props.winner,
          types: { attacker: props.attacker.battleType, defender: props.defender.battleType },
          stepKey: props.stepKey, elapsed: 0, clock: 0, speed: props.speed, paused: props.paused, burstDone: false, emitDebt: 0, bolt: { at: -1, points: [] },
        };
        sceneRef.current = scene;
        loadArena(scene, props.arenaSeed);
        if (latest.current.preloadMoves) loadMoves(scene, latest.current.preloadMoves, scene.sound);
        // 교대할 포켓몬 이미지를 미리 받아 둔다(Assets 캐시). 실패해도 교대 시점에 다시 시도한다.
        for (const key of ["attacker", "defender"] as const) for (const pokemon of props.teams[key]) {
          void loadVisual(pixi, pokemon.imagePath, key).catch(() => undefined);
          loadTypeAssets(scene, pokemon.battleType);
        }
        if (props.phase === "intro" && props.firstTurn) holdForToss(scene);
        for (const type of new Set([props.attacker.battleType, props.defender.battleType])) loadTypeAssets(scene, type);
        app.ticker.add((ticker) => { if (!scene.paused) renderField(scene, Math.min(ticker.deltaMS, 50)); });
        if (props.paused) renderField(scene, 0);
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
        // 선공 볼 던지기 중이면 등장은 던지기가 끝난 뒤에 한다.
        if (scene.phase === "intro" && scene.firstTurn && !scene.introEntered) return;
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
    // 이미지 로딩이 늦어 선공 연출이 intro 안에 끝나지 못했으면, 다음 단계로 넘어갈 때 바로 등장시킨다.
    // (그대로 두면 introEntered가 영영 false라 양측이 숨은 채 전투가 진행된다)
    if (scene.phase === "intro" && !scene.introEntered) enterBoth(scene);
    Object.assign(scene, { phase, actor, duration, multiplier, winner, stepKey, elapsed: 0, burstDone: false, emitDebt: 0, tossBurst: false });
    // 공격 단계마다 그 타입의 PokéRogue 기술 하나를 무작위로 골라 공격·명중 구간 동안 재생한다.
    if (phase === "attack" && actor) {
      scene.move = startMove(scene, actor, latest.current.move ?? null);
      if (!scene.move) latest.current.sound?.play(attackSoundUrl(scene.types[actor]), 0.9);
    } else if (phase !== "impact") scene.move = null;
    // 기술이 끝나면 기술 배경도 걷는다(PokéRogue도 애니메이션이 끝나면 배경을 지운다).
    if (!scene.move && scene.moveBackground) {
      scene.moveBackground.sprite.destroy();
      scene.moveBackground = null;
    }
  }, [actor, duration, multiplier, phase, stepKey, winner]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !replayKey) return;
    scene.pool.length = 0;
    for (const item of scene.sparks.items) item.sprite.visible = false;
    scene.sparks.items = [];
    if (latest.current.phase === "intro" && scene.firstTurn) holdForToss(scene);
    else enterBoth(scene);
  }, [replayKey]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (scene) scene.speed = speed;
  }, [speed]);

  // 이번 재생에서 쓸 기술을 미리 받는다(다시 보기마다 새로 고른 기술이 온다).
  useEffect(() => {
    const scene = sceneRef.current;
    if (scene && preloadMoves) loadMoves(scene, preloadMoves, scene.sound);
  }, [preloadMoves]);

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

function enterBoth(scene: Scene) {
  scene.introEntered = true;
  startEntrance(scene.sides.attacker);
  startEntrance(scene.sides.defender);
}

/** 기술 JSON과 이펙트 시트를 받아 둔다. 실패한 기술은 기본 연출로 대체된다. */
function loadMoves(scene: Scene, names: readonly string[], sound: () => SceneSound | undefined) {
  const sheet = async (graphic: string): Promise<Sheet> => {
    const base: import("pixi.js").Texture = await scene.pixi.Assets.load(moveGraphicUrl(graphic));
    base.source.scaleMode = "nearest";
    return { base, cells: new Map() };
  };
  for (const name of names) {
    if (scene.moves.has(name)) continue;
    scene.moves.set(name, null);
    void fetch(moveAnimUrl(name))
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(String(response.status))))
      .then(async (raw: unknown) => {
        const set = parseMoveAnim(raw);
        if (!set?.main.graphic) return;
        const main = await sheet(set.main.graphic);
        const opponent = set.opponent?.graphic ? await sheet(set.opponent.graphic).catch(() => null) : null;
        // 기술이 까는 배경 이미지도 미리 받는다(없으면 검은 배경).
        const backgrounds = new Map<string, import("pixi.js").Texture>();
        for (const resource of new Set([...set.main.backgrounds, ...(set.opponent?.backgrounds ?? [])].filter((event) => event.kind === "add" && event.resource).map((event) => event.resource))) {
          try {
            const texture: import("pixi.js").Texture = await scene.pixi.Assets.load(moveGraphicUrl(resource));
            texture.source.scaleMode = "nearest";
            backgrounds.set(resource, texture);
          } catch {
            // 배경을 못 받으면 그 배경만 건너뛴다.
          }
        }
        scene.moves.set(name, { set, main, opponent, backgrounds });
        for (const effect of [...set.main.sounds, ...(set.opponent?.sounds ?? [])]) sound()?.preload(moveSoundUrl(effect.resource));
      })
      .catch(() => {
        // 이 기술은 기본 연출로 대체한다.
      });
  }
}

function startMove(scene: Scene, actor: SideKey, name: string | null): ActiveMove | null {
  const entry = name ? scene.moves.get(name) : null;
  if (!name || !entry) return null;
  const other: SideKey = actor === "attacker" ? "defender" : "attacker";
  // 위쪽(상대) 포켓몬이 쓰고 상대 전용 변형이 있으면, 그 변형은 실제 대상(아래쪽)을 애니메이션의 '시전자' 자리로 그린다.
  if (actor === "defender" && entry.set.opponent && entry.opponent) return { name, anim: entry.set.opponent, sheet: entry.opponent, entry, clock: 0, fired: new Set(), firedBackgrounds: new Set(), animUser: other, animTarget: actor };
  return { name, anim: entry.set.main, sheet: entry.main, entry, clock: 0, fired: new Set(), firedBackgrounds: new Set(), animUser: actor, animTarget: other };
}

function moveCell(scene: Scene, sheet: Sheet, frame: number) {
  if (sheet.cells.has(frame)) return sheet.cells.get(frame) ?? null;
  const cell = effectCell(frame);
  const fits = cell.x + cell.width <= sheet.base.source.width && cell.y + cell.height <= sheet.base.source.height;
  const texture = fits ? new scene.pixi.Texture({ source: sheet.base.source, frame: new scene.pixi.Rectangle(cell.x, cell.y, cell.width, cell.height) }) : null;
  sheet.cells.set(frame, texture);
  return texture;
}

type Offsets = Record<SideKey, { x: number; y: number; alpha: number }>;

/** 기술 배경 이벤트(add/update)를 PokéRogue와 같은 위치·배율·시간으로 적용하고 진행 중인 변화를 갱신한다. */
function updateMoveBackground(scene: Scene, move: ActiveMove, index: number) {
  move.anim.backgrounds.forEach((event, order) => {
    if (event.frame > index || move.firedBackgrounds.has(order)) return;
    move.firedBackgrounds.add(order);
    const duration = event.duration * MOVE_FRAME_MS;
    if (event.kind === "add") {
      scene.moveBackground?.sprite.destroy();
      const texture = event.resource ? move.entry.backgrounds.get(event.resource) : undefined;
      const sprite = texture
        ? new scene.pixi.TilingSprite({ texture, width: 896, height: 576 })
        : Object.assign(new scene.pixi.Sprite(scene.pixi.Texture.WHITE), { width: 896, height: 576, tint: 0x000000 });
      sprite.position.set(event.bgX - 320, event.bgY - 284);
      sprite.scale.set(1.25);
      sprite.alpha = event.opacity / 255;
      sprite.zIndex = Z.moveBackground;
      scene.world.addChild(sprite);
      scene.moveBackground = { sprite, tweens: {} };
      return;
    }
    const background = scene.moveBackground;
    if (!background) return;
    const start = move.clock;
    background.tweens.x = { from: background.sprite.x, to: event.bgX * 0.5 - 320, start, duration };
    background.tweens.y = { from: background.sprite.y, to: event.bgY * 0.5 - 284, start, duration };
    background.tweens.alpha = { from: background.sprite.alpha, to: event.opacity / 255, start, duration };
  });
  const background = scene.moveBackground;
  if (!background) return;
  for (const key of ["x", "y", "alpha"] as const) {
    const tween = background.tweens[key];
    if (!tween) continue;
    const t = tween.duration > 0 ? clamp01((move.clock - tween.start) / tween.duration) : 1;
    background.sprite[key] = lerp(tween.from, tween.to, t);
  }
}

/**
 * 진행 중인 기술의 현재 프레임을 PokéRogue와 같은 규칙으로 그린다(프레임당 50ms, 프레임 사이는 보간).
 * 시전자·대상 요소는 포켓몬 위치·투명도·색조를 바꾸고, 이펙트 셀은 우선순위에 맞는 깊이에 스프라이트로 놓는다.
 */
function drawMove(scene: Scene, delta: number, hitstop: boolean, offsets: Offsets, center: (key: SideKey) => { x: number; y: number }, field: { x: number; y: number; scale: number }, sound: SceneSound | undefined) {
  for (const sprite of scene.moveSprites) sprite.visible = false;
  for (const side of Object.values(scene.sides)) side.tone = [0, 0, 0, 0];
  const move = scene.move;
  if (!move) return;
  if (!hitstop) move.clock += delta;
  const index = Math.floor(move.clock / MOVE_FRAME_MS);
  move.anim.sounds.forEach((effect, order) => {
    if (effect.frame > index || move.fired.has(order)) return;
    move.fired.add(order);
    sound?.play(moveSoundUrl(effect.resource), effect.volume, effect.pitch);
  });
  updateMoveBackground(scene, move, index);
  const current = move.anim.frames[index];
  if (!current) return;
  const frame = interpolateFrame(current, move.anim.frames[index + 1], (move.clock % MOVE_FRAME_MS) / MOVE_FRAME_MS);
  const user = center(move.animUser);
  const target = center(move.animTarget);
  const sideZ = (key: SideKey) => key === "attacker" ? Z.attacker : Z.defender;
  let used = 0;
  for (const element of frame) {
    if (element.target === 0 || element.target === 1) {
      const key = element.target === 0 ? move.animUser : move.animTarget;
      const rest = placeMoveElement({ ...element, x: element.target === 0 ? 0 : 128, y: element.target === 0 ? 0 : -64 }, user, target, field);
      const now = placeMoveElement(element, user, target, field);
      offsets[key].x += now.x - rest.x;
      offsets[key].y += now.y - rest.y;
      offsets[key].alpha *= element.visible ? element.opacity / 255 : 0;
      scene.sides[key].tone = element.tone;
      continue;
    }
    if (!element.visible || element.opacity <= 0) continue;
    const texture = moveCell(scene, move.sheet, element.graphicFrame);
    const sprite = scene.moveSprites[used];
    if (!texture || !sprite) continue;
    used++;
    const at = placeMoveElement(element, user, target, field);
    sprite.texture = texture;
    sprite.visible = true;
    sprite.position.set(at.x, at.y);
    sprite.scale.set(field.scale * element.zoomX / 100 * (element.mirror ? -1 : 1) * (at.flip ? -1 : 1), field.scale * element.zoomY / 100);
    sprite.rotation = -element.angle * Math.PI / 180;
    sprite.alpha = element.opacity / 255;
    sprite.blendMode = element.blendType === 1 ? "add" : "normal";
    // 그리는 순서: 0 위쪽 포켓몬 뒤, 2 기준 포켓몬 뒤(배경이 있으면 배경 바로 위), 3 기준 포켓몬 바로 앞, 그 밖은 맨 앞
    const focusSide = element.focus === 1 ? move.animTarget : element.focus === 2 ? move.animUser : null;
    sprite.zIndex = element.priority === 0 ? Z.defender - 0.5
      : element.priority === 2 ? (scene.moveBackground ? Z.moveBackground + 0.5 : focusSide ? sideZ(focusSide) - 0.5 : Z.moveTop)
        : element.priority === 3 && focusSide ? sideZ(focusSide) + 0.5
          : Z.moveTop + used * 0.001;
  }
}

/** 선공 연출이 끝날 때까지 양측을 숨긴다. */
function holdForToss(scene: Scene) {
  scene.introEntered = false;
  for (const side of Object.values(scene.sides)) {
    side.entrance = null;
    side.hidden = true;
  }
}

function loadArena(scene: Scene, seed: string) {
  const arena = battleArena(seed);
  const load = (url: string, sprite: import("pixi.js").Sprite) => scene.pixi.Assets.load(url).then((texture: import("pixi.js").Texture) => {
    texture.source.scaleMode = "nearest";
    sprite.texture = texture;
    sprite.visible = true;
  }, () => {
    // 배경을 못 불러오면 CSS 기본 전투장 그림이 그대로 보인다.
  });
  void load(arena.background, scene.arena.background);
  void load(arena.attackerBase, scene.arena.attackerBase);
  void load(arena.defenderBase, scene.arena.defenderBase);
  // 파티클 이미지를 받아 불투명 픽셀 덩어리마다 한 조각으로 자른다(AGPL 아틀라스 JSON은 쓰지 않는다).
  scene.pixi.Assets.load(POKEBALL_PARTICLES).then((base: import("pixi.js").Texture) => {
    const image = base.source.resource as CanvasImageSource | undefined;
    if (!image) return;
    const canvas = document.createElement("canvas");
    canvas.width = base.source.width;
    canvas.height = base.source.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const boxes = particleBoxes((x, y) => pixels[(y * canvas.width + x) * 4 + 3], canvas.width, canvas.height);
    base.source.scaleMode = "nearest";
    scene.sparks.textures = boxes.map((box) => new scene.pixi.Texture({ source: base.source, frame: new scene.pixi.Rectangle(box.x, box.y, box.w, box.h) }));
  }, () => {
    // 이미지가 없으면 Graphics 파티클만 쓴다.
  });
  for (const [state, url] of Object.entries(POKEBALL_SPRITES) as [BallState, string][]) {
    scene.pixi.Assets.load(url).then((texture: import("pixi.js").Texture) => {
      texture.source.scaleMode = "nearest";
      scene.ballTextures[state] = texture;
    }, () => {
      // 볼 스프라이트가 없으면 Graphics로 그린 볼을 쓴다.
    });
  }
}

/**
 * 볼이 열릴 때 PokéRogue 방출 파티클을 원형으로 뿌린다. 아틀라스가 없으면 false를 돌려 Graphics 파티클로 대체한다.
 */
function emitSparks(scene: Scene, x: number, y: number, count: number, speed: number, scale: number) {
  const { textures, pool, items } = scene.sparks;
  if (!textures.length) return false;
  const total = Math.round(count * (scene.quality.compact ? 0.6 : 1));
  for (let index = 0; index < total; index++) {
    const sprite = pool.find((item) => !item.visible);
    if (!sprite) break;
    const angle = index / total * Math.PI * 2 + random(-0.2, 0.2);
    const velocity = speed * random(0.6, 1.15);
    sprite.texture = pick(textures);
    sprite.visible = true;
    items.push({ sprite, x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity - speed * 0.15, life: 0, maxLife: random(420, 720), spin: random(-5, 5), scale: scale * random(0.8, 1.3) });
  }
  return true;
}

function updateSparks(scene: Scene, delta: number) {
  const seconds = delta / 1_000;
  scene.sparks.items = scene.sparks.items.filter((item) => {
    item.life += delta;
    const t = item.life / item.maxLife;
    if (t >= 1) {
      item.sprite.visible = false;
      return false;
    }
    item.vx *= Math.max(0, 1 - 2.4 * seconds);
    item.vy = item.vy * Math.max(0, 1 - 2.4 * seconds) + 40 * seconds;
    item.x += item.vx * seconds;
    item.y += item.vy * seconds;
    item.sprite.position.set(item.x, item.y);
    item.sprite.rotation += item.spin * seconds;
    item.sprite.scale.set(item.scale * (1 - t * 0.4));
    item.sprite.alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    return true;
  });
}

/** 몬스터볼 한 개를 그린다. 스프라이트가 없으면 Graphics 볼로 대체한다. */
function placeBall(scene: Scene, x: number, y: number, rotation: number, state: BallState, scale: number, alpha = 1) {
  const texture = scene.ballTextures[state] ?? (state !== "closed" ? scene.ballTextures.closed : undefined);
  const sprite = scene.balls[scene.ballIndex];
  if (!texture || !sprite) {
    if (alpha > 0.2) drawBall(scene.shapes, x, y, 5 * scale, rotation);
    return;
  }
  scene.ballIndex++;
  sprite.texture = texture;
  sprite.visible = true;
  sprite.position.set(x, y);
  sprite.rotation = rotation;
  sprite.scale.set(scale);
  sprite.alpha = alpha;
}

function startEntrance(side: Side) {
  side.entrance = 0;
  side.entranceBurst = false;
  side.hidden = false;
}

/** 외부 스프라이트를 우선순위대로 시도하고, 모두 실패하면 예외를 던진다(호출부가 DOM 로그로 전환). */
/** PokéRogue 스프라이트 아틀라스(트림된 프레임 목록)를 원래 크기 기준 프레임 텍스처로 만든다. 같은 주소는 한 번만 받는다. */
const atlasCache = new Map<string, Promise<GifFrame[]>>();

function loadAtlas(pixi: Pixi, candidate: SpriteCandidate & { atlas: string }) {
  const cached = atlasCache.get(candidate.atlas);
  if (cached) return cached;
  const promise = (async () => {
    const response = await fetch(candidate.atlas);
    if (!response.ok) throw new Error(String(response.status));
    const atlas = await response.json() as { textures?: { frames?: { filename?: string; frame?: { x: number; y: number; w: number; h: number }; sourceSize?: { w: number; h: number }; spriteSourceSize?: { x: number; y: number; w: number; h: number } }[] }[] };
    const list = (atlas.textures?.[0]?.frames ?? []).filter((item) => item.frame && item.sourceSize && item.spriteSourceSize).sort((a, b) => String(a.filename).localeCompare(String(b.filename)));
    if (!list.length) throw new Error("empty atlas");
    const base: import("pixi.js").Texture = await pixi.Assets.load(candidate.url);
    base.source.scaleMode = "nearest";
    return list.map((item, index) => ({
      texture: new pixi.Texture({
        source: base.source,
        frame: new pixi.Rectangle(item.frame!.x, item.frame!.y, item.frame!.w, item.frame!.h),
        orig: new pixi.Rectangle(0, 0, item.sourceSize!.w, item.sourceSize!.h),
        trim: new pixi.Rectangle(item.spriteSourceSize!.x, item.spriteSourceSize!.y, item.spriteSourceSize!.w, item.spriteSourceSize!.h),
      }),
      start: index * POKEMON_SPRITE_FRAME_MS,
      end: (index + 1) * POKEMON_SPRITE_FRAME_MS,
    }));
  })();
  atlasCache.set(candidate.atlas, promise);
  promise.catch(() => atlasCache.delete(candidate.atlas));
  return promise;
}

async function loadVisual(pixi: Pixi, imagePath: string, side: SideKey): Promise<Visual> {
  for (const candidate of battleSpriteCandidates(imagePath, side)) {
    try {
      if (candidate.atlas) {
        const frames = await loadAtlas(pixi, candidate as SpriteCandidate & { atlas: string });
        return { texture: frames[0].texture, frames, candidate };
      }
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

/** 같은 시트를 투사체·명중이 다른 셀로 쓰므로 URL과 셀 목록을 함께 키로 쓴다. */
const sheetKey = (sheet: EffectSheet) => `${sheet.url}#${sheet.frames.join(",")}`;

function loadSheet(scene: Scene, sheet: EffectSheet | undefined) {
  if (!sheet || scene.sheets.has(sheetKey(sheet))) return;
  scene.sheets.set(sheetKey(sheet), null);
  scene.pixi.Assets.load(sheet.url).then((base: import("pixi.js").Texture) => {
    base.source.scaleMode = "nearest";
    const frames = sheet.frames.map((frame) => {
      const cell = effectCell(frame);
      return new scene.pixi.Texture({ source: base.source, frame: new scene.pixi.Rectangle(cell.x, cell.y, cell.width, cell.height) });
    });
    scene.sheets.set(sheetKey(sheet), frames);
  }, () => {
    // 외부 이펙트 시트는 장식이므로 실패하면 Graphics 연출만 쓴다.
  });
}

/** 시트가 준비됐으면 경과 시간에 맞는 프레임을 돌려준다. */
function sheetFrame(scene: Scene, sheet: EffectSheet | undefined, time: number, loop: boolean) {
  const frames = sheet ? scene.sheets.get(sheetKey(sheet)) : null;
  if (!sheet || !frames?.length) return null;
  const index = Math.floor(time / sheet.frameMs);
  if (!loop && index >= frames.length) return null;
  return frames[index % frames.length];
}

/** 타입의 PokéRogue 투사체·명중 시트를 미리 받는다(자체 타입 아이콘 이미지는 쓰지 않는다). */
function loadTypeAssets(scene: Scene, type: string) {
  const sheets = effectSheetsFor(type);
  loadSheet(scene, sheets.projectile);
  loadSheet(scene, sheets.impact);
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

/** 한 프레임을 진행하고 320×180 텍스처에 그린 뒤, 캔버스 크기에 맞춰 확대한다. */
function renderField(scene: Scene, delta: number) {
  update(scene, delta);
  scene.app.renderer.render({ container: scene.fieldRoot, target: scene.fieldTexture, clear: true });
  scene.screen.scale.set(scene.app.screen.width / FIELD.width, scene.app.screen.height / FIELD.height);
}

function update(scene: Scene, rawDelta: number) {
  const { app, world, back, shapes, particles, overlay, projectile, sides } = scene;
  // 모든 좌표는 320×180 필드 픽셀 단위다(렌더 텍스처에 그린 뒤 확대).
  const width = FIELD.width;
  const height = FIELD.height;
  const delta = rawDelta * scene.speed;
  // 320×180 필드를 무대에 꽉 차게(cover) 맞춘다. 무대는 16:9라 보통 잘리는 부분이 없다.
  const fieldScale = 1;
  const fieldX = 0;
  const fieldY = 0;
  const size = fieldScale * 64;
  const home: Record<SideKey, { x: number; y: number }> = {
    attacker: { x: fieldX + FIELD_SPOTS.attacker.x * fieldScale, y: fieldY + FIELD_SPOTS.attacker.y * fieldScale },
    defender: { x: fieldX + FIELD_SPOTS.defender.x * fieldScale, y: fieldY + FIELD_SPOTS.defender.y * fieldScale },
  };
  // PokéRogue처럼 포켓몬 중심 = 발 위치 - 스프라이트 높이의 절반
  const center = (key: SideKey) => ({ x: home[key].x, y: home[key].y - Math.max(sides[key].sprite.texture.orig.height, 16) / 2 });
  const ballScale = 1;
  const trainer: Record<SideKey, { x: number; y: number }> = { attacker: { x: -0.04 * width, y: 0.96 * height }, defender: { x: 1.04 * width, y: 0.18 * height } };
  scene.arena.background.position.set(fieldX, fieldY);
  scene.arena.background.scale.set(fieldScale);
  for (const base of [scene.arena.attackerBase, scene.arena.defenderBase]) {
    // PokéRogue처럼 발판도 필드 왼쪽 위(0,0)에 맞춘다.
    base.position.set(fieldX, fieldY);
    base.scale.set(fieldScale);
  }
  scene.ballIndex = 0;
  for (const ball of scene.balls) ball.visible = false;
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

  // 선공 결정: 두 트레이너의 몬스터볼이 맞부딪치고, 선공 쪽 볼이 금빛으로 떠오른다.
  if (phase === "intro" && scene.firstTurn && !scene.introEntered) {
    const t = clamp01(scene.elapsed / TOSS_MS);
    const meet = { x: width * 0.5, y: height * 0.42 };
    const first = scene.firstTurn;
    if (t < TOSS_CLASH) {
      const p = easeOutCubic(t / TOSS_CLASH);
      for (const key of ["attacker", "defender"] as const) {
        const from = trainer[key];
        const x = lerp(from.x, meet.x + (key === "attacker" ? -1 : 1) * ballScale * 6, p);
        const y = lerp(from.y, meet.y, p) - Math.sin(p * Math.PI) * height * 0.18;
        placeBall(scene, x, y, t * 30 * (key === "attacker" ? 1 : -1), "closed", ballScale);
      }
    } else {
      if (!scene.tossBurst) {
        scene.tossBurst = true;
        if (!emitSparks(scene, meet.x, meet.y, 22, size * 3, fieldScale * 1.5)) emit(scene, 22, () => { const a = random(0, Math.PI * 2); const v = random(90, 240); return { x: meet.x, y: meet.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 0, drag: 3.5, maxLife: random(260, 480), size: random(2, 5), color: pick(["#ffffff", "#fef08a", "#facc15"]), shape: pick(["star", "pixel"] as const), spin: random(-8, 8) }; });
      }
      const p = segment(t, TOSS_CLASH, 1);
      const flash = 1 - segment(p, 0, 0.25);
      if (flash > 0) shapes.star(meet.x, meet.y, 8, size * (0.2 + (1 - flash) * 0.35), size * 0.08, p * 3).fill({ color: 0xffffff, alpha: flash });
      const loser: SideKey = first === "attacker" ? "defender" : "attacker";
      const away = loser === "attacker" ? -1 : 1;
      // 진 쪽 볼은 튕겨 나가 떨어지고, 선공 쪽 볼은 떠올라 반짝인다.
      placeBall(scene, meet.x + away * p * width * 0.22, meet.y - Math.sin(p * Math.PI) * height * 0.12 + p * p * height * 0.45, p * 14 * away, "closed", ballScale, 1 - segment(p, 0.5, 1));
      const rise = easeOutBack(segment(p, 0, 0.45));
      const winX = meet.x + (first === "attacker" ? -1 : 1) * ballScale * 4 * (1 - rise);
      const winY = meet.y - rise * height * 0.12 + Math.sin(scene.elapsed / 90) * 2;
      const glow = 0.5 + Math.sin(scene.elapsed / 70) * 0.5;
      shapes.circle(winX, winY, ballScale * (14 + glow * 4)).fill({ color: 0xfacc15, alpha: 0.18 + glow * 0.12 }).stroke({ width: 2, color: 0xfde68a, alpha: 0.9 });
      placeBall(scene, winX, winY, 0, p > 0.75 ? "opening" : "closed", ballScale * 1.25);
      stream(scene, delta, 22, () => ({ x: winX + random(-ballScale * 12, ballScale * 12), y: winY + random(-ballScale * 10, ballScale * 10), vx: random(-10, 10), vy: random(-50, -20), gravity: 0, drag: 0.5, maxLife: random(400, 700), size: random(2, 4), color: pick(["#facc15", "#fef08a", "#ffffff"]), shape: "star", spin: random(-3, 3) }));
    }
    if (scene.elapsed >= TOSS_MS) enterBoth(scene);
  }

  // 등장: 몬스터볼 투척 → 섬광 → 포켓몬
  (["attacker", "defender"] as const).forEach((key) => {
    const side = sides[key];
    if (side.entrance === null) return;
    const t = clamp01(side.entrance / ENTRANCE_MS);
    const target = center(key);
    const start = trainer[key];
    if (t < BALL_OPEN) {
      const p = easeOutCubic(t / BALL_OPEN);
      const x = lerp(start.x, target.x, p);
      const y = lerp(start.y, target.y, p) - Math.sin(p * Math.PI) * height * 0.22;
      placeBall(scene, x, y, t * 26 * (key === "attacker" ? 1 : -1), "closed", ballScale);
      offsets[key].alpha = 0;
    } else {
      if (!side.entranceBurst) {
        side.entranceBurst = true;
        if (!emitSparks(scene, target.x, target.y - size * 0.1, 18, size * 2.6, fieldScale * 1.4)) emit(scene, 18, () => { const a = random(0, Math.PI * 2); const s = random(80, 200); return { x: target.x, y: target.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, gravity: 0, drag: 3.5, maxLife: random(300, 520), size: random(2, 4), color: pick(["#ffffff", "#dbeafe", "#fef9c3"]), shape: pick(["pixel", "star"] as const), spin: random(-6, 6) }; });
      }
      const open = segment(t, BALL_OPEN, BALL_OPEN + 0.22);
      if (open < 1) placeBall(scene, target.x, target.y - size * 0.1, 0, open < 0.35 ? "opening" : "open", ballScale, 1 - open);
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

  const moveActive = Boolean(scene.move) && (phase === "attack" || phase === "impact");

  // 공격: PokéRogue 기술이 없을 때만 계열별 기본 투사체
  if (phase === "attack" && actor && !moveActive) {
    const from = center(source);
    const to = center(targetKey);
    const direction = to.x > from.x ? 1 : -1;
    const p = easeInCubic(progress) * 0.35 + progress * 0.65;
    const lunge = Math.sin(clamp01(progress * 1.6) * Math.PI);
    offsets[source].x += direction * lunge * (effect.motion === "strike" ? size * 0.55 : 12);
    offsets[source].y -= lunge * (effect.motion === "strike" ? 10 : 3);
    drawProjectile(scene, delta, effect.motion, palette, effectSheetsFor(scene.types[source]).projectile, from, to, p, direction, size);
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
      // 히트스톱 동안 투사체를 대상 앞에 멈춰 둔다(기본 연출일 때만).
      const hold = moveActive ? null : sheetFrame(scene, effectSheetsFor(scene.types[source]).projectile, 0, true);
      if (hold) placeProjectile(projectile, hold, to.x - direction * 10, to.y, direction, size * 1.1);
      if (profile.screenFlash) overlay.rect(0, 0, width, height).fill({ color: 0xffffff, alpha: profile.screenFlash });
    } else {
      if (!scene.burstDone) {
        scene.burstDone = true;
        if (!moveActive) burst(scene, to.x, to.y, effect.motion, palette, profile, scene.types[source] === "ice");
      }
      const ip = impactProgress;
      const knock = easeOutCubic(segment(ip, 0, 0.18)) * (1 - segment(ip, 0.3, 1)) * profile.knockback;
      offsets[targetKey].x += direction * knock;
      offsets[targetKey].x += ip < 0.35 ? (Math.random() - 0.5) * 6 * profile.burst : 0;
      offsets[targetKey].flash = ip < 0.4 ? (Math.floor(ip * 20) % 2 ? 0.85 : 0.1) : 0;
      offsets[targetKey].sx *= 1 - Math.sin(segment(ip, 0, 0.3) * Math.PI) * 0.08;
      const impactSheet = effectSheetsFor(scene.types[source]).impact;
      const frame = moveActive ? null : sheetFrame(scene, impactSheet, impactLocal, false) ?? (impactSheet?.frames.length === 1 && ip < 0.5 ? sheetFrame(scene, impactSheet, 0, false) : null);
      // PokéRogue 기술이나 명중 시트가 있으면 그것만 보이고, 없을 때만 Graphics 고리·섬광을 그린다.
      if (!moveActive && !frame && !(impactSheet && scene.sheets.get(sheetKey(impactSheet)))) drawImpact(shapes, effect.motion, palette, to.x, to.y, ip, size, profile);
      if (frame) {
        const pop = impactSheet?.frames.length === 1 ? easeOutBack(segment(ip, 0, 0.25)) * (1 - segment(ip, 0.35, 0.5)) : 1;
        placeProjectile(scene.effect, frame, to.x, to.y, direction, size * 1.4 * Math.sqrt(profile.burst) * pop);
      }
      // 흔들림은 필드 픽셀 단위라 화면 기준 값보다 작게 준다.
      shake = profile.shake * 0.4 * (1 - segment(ip, 0, 0.55)) ** 2;
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
      const ball = actor === "attacker" ? { x: width * 0.06, y: height * 0.86 } : { x: width * 0.94, y: height * 0.2 };
      placeBall(scene, ball.x, ball.y, 0, fade < 0.85 ? "open" : "closed", ballScale);
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

  drawMove(scene, delta, hitstop, offsets, center, { x: fieldX, y: fieldY, scale: fieldScale }, scene.sound());

  // 포켓몬과 바닥 그림자
  (["attacker", "defender"] as const).forEach((key) => {
    const side = sides[key];
    const offset = offsets[key];
    const visible = !side.hidden || side.entrance !== null || (phase === "recall" && actor === key);
    const alpha = visible ? offset.alpha : 0;
    // 꼭 맞게 잘린 GIF는 픽셀 배율을, 여백 있는 96px PNG는 폭 기준 배율을 쓴다.
    // GIF는 필드 픽셀 배율 그대로(가까운 공격 측을 조금 크게), 여백 있는 96px PNG는 조금 더 키운다. 너무 큰 포켓몬은 상한을 둔다.
    // 원작과 같은 픽셀 밀도: 스프라이트는 원래 크기 그대로(1배) 그린다.
    side.baseScale = 1;
    const facing = side.candidate.flip ? -1 : 1;
    const x = home[key].x + offset.x;
    const y = home[key].y + offset.y;
    for (const sprite of [side.sprite, side.flash]) {
      sprite.position.set(x, y);
      sprite.scale.set(facing * side.baseScale * offset.sx, side.baseScale * offset.sy);
    }
    side.sprite.alpha = alpha;
    side.sprite.tint = offset.tint;
    // 기술 애니메이션 색조(PokéRogue 셰이더와 같은 계산)
    if (hasTone(side.tone)) {
      side.toneFilter.matrix = toneMatrix(side.tone) as typeof side.toneFilter.matrix;
      if (side.sprite.filters !== side.toneFilters) side.sprite.filters = side.toneFilters;
    } else if (side.sprite.filters) side.sprite.filters = null;
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

  updateSparks(scene, hitstop ? 0 : delta);

  // 카메라
  world.pivot.set(width / 2, height / 2);
  world.position.set(width / 2 + (shake ? (Math.random() - 0.5) * 2 * shake : 0), height / 2 + (shake ? (Math.random() - 0.5) * 2 * shake : 0));
  world.scale.set(1 + punch);
}

function drawProjectile(scene: Scene, delta: number, motion: BattleMotion, palette: BattlePalette, projectileSheet: EffectSheet | undefined, from: { x: number; y: number }, to: { x: number; y: number }, p: number, direction: number, size: number) {
  const { shapes, projectile } = scene;
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

  const sheetTexture = sheetFrame(scene, projectileSheet, scene.elapsed, true);
  if (sheetTexture) placeProjectile(projectile, sheetTexture, x, y, direction, size * 1.1);
  // 시트를 아직 못 받았거나 실패하면 도형으로 그린다.
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
