// 랭킹전 전투장이 런타임에 불러오는 외부 이미지 주소.
// 저장소에는 파일을 넣지 않고 URL만 둔다. 출처·라이선스는 docs/policy/pokedex-ranking-battle-animation.md에 적는다.
// 모든 주소는 CORS(access-control-allow-origin: *)를 확인했고, 실패하면 기존 정적 이미지·Graphics 연출로 돌아간다.
import { battleEffect, type BattleMotion, type BattleType } from "@/lib/pokedex/battle-effects";

const POKEAPI_SPRITES = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
const POKEAPI_PNG = /^https:\/\/raw\.githubusercontent\.com\/PokeAPI\/sprites\/master\/sprites\/pokemon\/(\d+)\.png$/;
const POKEROGUE_IMAGES = "https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/images";
const POKEROGUE_ANIMS = `${POKEROGUE_IMAGES}/battle_anims`;
const POKEROGUE_AUDIO = "https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/audio";

export type SpriteCandidate = {
  url: string;
  /** 애니메이션 GIF면 프레임을 직접 넘긴다. */
  animated: boolean;
  /** 원본 스프라이트가 바라보는 방향을 장면 방향에 맞추기 위한 좌우 반전 */
  flip: boolean;
  /** 발 위치(세로 기준점). 여백 있는 96px PNG와 꼭 맞게 잘린 GIF가 다르다. */
  anchorY: number;
};

/**
 * 공격 측(왼쪽 아래)은 뒷모습, 방어 측(오른쪽 위)은 앞모습을 우선 쓰고,
 * 실패하면 원래 이미지(imagePath)로 내려간다. PokeAPI 형식이 아니면 원래 이미지만 쓴다.
 */
export function battleSpriteCandidates(imagePath: string, side: "attacker" | "defender"): SpriteCandidate[] {
  const original: SpriteCandidate = { url: imagePath, animated: false, flip: side === "attacker", anchorY: 0.82 };
  const match = POKEAPI_PNG.exec(imagePath);
  if (!match) return [original];
  const no = match[1];
  return side === "attacker"
    ? [
        { url: `${POKEAPI_SPRITES}/other/showdown/back/${no}.gif`, animated: true, flip: false, anchorY: 0.98 },
        { url: `${POKEAPI_SPRITES}/back/${no}.png`, animated: false, flip: false, anchorY: 0.86 },
        original,
      ]
    : [{ url: `${POKEAPI_SPRITES}/other/showdown/${no}.gif`, animated: true, flip: false, anchorY: 0.98 }, original];
}

export type EffectSheet = { url: string; frames: readonly number[]; frameMs: number };

const sheet = (name: string, frames: readonly number[], frameMs = 50): EffectSheet => ({ url: `${POKEROGUE_ANIMS}/${encodeURIComponent(name)}`, frames, frameMs });
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

/** 96px 정사각 셀이 5열로 놓인 시트. 프레임 번호는 시트를 직접 보고 고른 셀 위치(행 × 5 + 열)다. */
export const EFFECT_CELL = 96;
export const EFFECT_COLUMNS = 5;

export const BATTLE_EFFECT_SHEETS: Record<BattleMotion, { projectile?: EffectSheet; impact?: EffectSheet }> = {
  flame: { projectile: sheet("PRAS- Fire.png", range(20, 22), 70), impact: sheet("PRAS- Fire.png", range(6, 13), 55) },
  splash: { projectile: sheet("PRAS- Water.png", range(43, 46), 70), impact: sheet("PRAS- Water.png", range(31, 39), 50) },
  bolt: { impact: sheet("PRAS- Electric.png", range(0, 9), 45) },
  leaf: { projectile: sheet("PRAS- Magical Leaf.png", range(4, 12), 60), impact: sheet("PRAS- Magical Leaf.png", [13, 14, 13, 14], 70) },
  strike: { projectile: sheet("PRAS- Iron Head.png", [1], 60), impact: sheet("Tackle_B.png", [0], 60) },
  wave: { projectile: sheet("PRAS- Psybeam.png", range(0, 3), 70) },
};

/** 타입별로 더 맞는 시트가 있으면 계열 기본값 대신 쓴다. 셀 번호는 시트를 보고 고른 것이다. */
const TYPE_EFFECT_SHEETS: Partial<Record<BattleType, { projectile?: EffectSheet; impact?: EffectSheet }>> = {
  ice: { projectile: sheet("PRAS- Ice.png", [7], 60), impact: sheet("PRAS- Ice.png", range(8, 11), 60) },
  poison: { projectile: sheet("PRAS- Poison.png", [0, 1], 80), impact: sheet("PRAS- Poison.png", range(8, 15), 55) },
  rock: { projectile: sheet("PRAS- Rock.png", [0], 60), impact: sheet("PRAS- Iron Head.png", [0, 1, 0, 1], 60) },
  ground: { projectile: sheet("PRAS- Mud Shot.png", [0], 60), impact: sheet("PRAS- Rock.png", range(1, 5), 60) },
  steel: { impact: sheet("PRAS- Iron Head.png", [0, 1, 0, 1], 60) },
  fighting: { projectile: sheet("PRAS- Shadow Punch.png", [0], 60), impact: sheet("PRAS- Iron Head.png", [0, 1, 0, 1], 60) },
  dragon: { projectile: sheet("PRAS- Dragon Pulse.png", range(5, 8), 60), impact: sheet("PRAS- Dragon Pulse.png", range(1, 4), 70) },
  flying: { projectile: sheet("PRAS- Gust.png", [0], 60) },
  ghost: { projectile: sheet("PRAS- Shadow Ball.png", range(1, 4), 70) },
  psychic: { projectile: sheet("PRAS- Psycho Cut.png", [0], 60) },
  fairy: { projectile: sheet("PRAS- Fairy Wind.png", [0], 60) },
  bug: { projectile: sheet("PRAS- Silver Wind.png", [0], 60) },
};

export function effectSheetsFor(type: string) {
  const effect = battleEffect(type);
  return { ...BATTLE_EFFECT_SHEETS[effect.motion], ...TYPE_EFFECT_SHEETS[type as BattleType] };
}

/** 타입별 공격 효과음(PokéRogue battle_anims). PRSFX- 접두 파일은 Pokémon Reborn 팀 제작이다. */
const ATTACK_SOUND_FILES: Record<BattleType, string> = {
  normal: "PRSFX- Double Hit.wav", fire: "PRSFX- Ember.wav", water: "PRSFX- Bubble.wav", electric: "GEN8- Electricity1.wav",
  grass: "PRSFX- Razor Leaf1.wav", ice: "PRSFX- Ice Beam.wav", fighting: "Mega Punch.m4a", poison: "PRSFX- Sludge.wav",
  ground: "PRSFX- Mud Shot.wav", flying: "PRSFX- Gust.wav", psychic: "PRSFX- Confusion.wav", bug: "PRSFX- Bug Buzz.wav",
  rock: "PRSFX- Rock Slide.wav", ghost: "PRSFX- Shadow Ball1.wav", dragon: "PRSFX- Dragon Pulse.wav", fairy: "PRSFX- Fairy Wind.wav",
  steel: "PRSFX- Metal Claw1.wav",
};

export function attackSoundUrl(type: string) {
  const file = ATTACK_SOUND_FILES[(Object.hasOwn(ATTACK_SOUND_FILES, type) ? type : "normal") as BattleType];
  return `${POKEROGUE_AUDIO}/battle_anims/${encodeURIComponent(file)}`;
}

export function effectCell(frame: number) {
  return { x: frame % EFFECT_COLUMNS * EFFECT_CELL, y: Math.floor(frame / EFFECT_COLUMNS) * EFFECT_CELL, width: EFFECT_CELL, height: EFFECT_CELL };
}

/** PokéRogue 전투장은 320×180 필드에 배경(bg)과 발판(a: 플레이어, b: 상대, 320×132, 아래 정렬)을 겹친다. */
export const FIELD = { width: 320, height: 180, baseHeight: 132 } as const;
/** 발판 이미지를 보고 잡은 포켓몬 발 위치(필드 좌표) */
export const FIELD_SPOTS = { attacker: { x: 102, y: 170 }, defender: { x: 216, y: 118 } } as const;

const ARENAS = ["plains", "grass", "tall_grass", "meadow", "forest", "lake", "beach", "town", "mountain"] as const;

/** 같은 전투 기록은 항상 같은 배경을 고른다. */
export function battleArena(seed: string) {
  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const name = ARENAS[hash % ARENAS.length];
  return { name, background: `${POKEROGUE_IMAGES}/arenas/${name}_bg.png`, attackerBase: `${POKEROGUE_IMAGES}/arenas/${name}_a.png`, defenderBase: `${POKEROGUE_IMAGES}/arenas/${name}_b.png` };
}

/** 몬스터볼 12×16 스프라이트: 닫힘 → 열리는 중 → 열림 */
export const POKEBALL_SPRITES = {
  closed: `${POKEROGUE_IMAGES}/pokeball/pb.png`,
  opening: `${POKEROGUE_IMAGES}/pokeball/pb_opening.png`,
  open: `${POKEROGUE_IMAGES}/pokeball/pb_open.png`,
} as const;

/**
 * 몬스터볼 방출 파티클 이미지(80×8, 별·빛 조각 여러 개). 같은 이름의 JSON 아틀라스는 AGPL 데이터라 쓰지 않고,
 * 이미지의 불투명 픽셀 덩어리를 직접 찾아 조각으로 자른다(`particleBoxes`).
 */
export const POKEBALL_PARTICLES = `${POKEROGUE_IMAGES}/effects/pb_particles.png`;

/** RGBA 픽셀에서 서로 붙어 있는 불투명 픽셀 덩어리의 경계 상자를 찾는다(8방향 연결). */
export function particleBoxes(alpha: (x: number, y: number) => number, width: number, height: number, minSize = 2) {
  const seen = new Uint8Array(width * height);
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (seen[y * width + x] || alpha(x, y) === 0) continue;
    let minX = x, maxX = x, minY = y, maxY = y;
    const stack = [[x, y]];
    seen[y * width + x] = 1;
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      minX = Math.min(minX, cx); maxX = Math.max(maxX, cx); minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || seen[ny * width + nx] || alpha(nx, ny) === 0) continue;
        seen[ny * width + nx] = 1;
        stack.push([nx, ny]);
      }
    }
    const box = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    if (box.w >= minSize || box.h >= minSize) boxes.push(box);
  }
  return boxes;
}

/** 효과음 샘플(WAV). 불러오지 못하면 Web Audio 합성음으로 대체한다. */
export const BATTLE_SOUND_SAMPLES = {
  throw: `${POKEROGUE_AUDIO}/se/pb_throw.wav`,
  release: `${POKEROGUE_AUDIO}/se/pb_rel.wav`,
  hit: `${POKEROGUE_AUDIO}/se/hit.wav`,
  hitStrong: `${POKEROGUE_AUDIO}/se/hit_strong.wav`,
  hitWeak: `${POKEROGUE_AUDIO}/se/hit_weak.wav`,
  faint: `${POKEROGUE_AUDIO}/se/faint.wav`,
  charge: `${POKEROGUE_AUDIO}/se/charge.wav`,
  victory: `${POKEROGUE_AUDIO}/se/level_up_fanfare.wav`,
} as const;

/** 전투 배경음악(MP3, 약 2.6MB). 모달을 열고 배경음악이 켜져 있을 때만 받는다. */
export const BATTLE_BGM = `${POKEROGUE_AUDIO}/bgm/battle_trainer.mp3`;
