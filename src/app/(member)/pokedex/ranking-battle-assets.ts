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
  /** PokéRogue 스프라이트 아틀라스(JSON 주소). url은 같은 이름의 PNG다. */
  atlas?: string;
  /** 원본 스프라이트가 바라보는 방향을 장면 방향에 맞추기 위한 좌우 반전 */
  flip: boolean;
  /** 발 위치(세로 기준점). 여백 있는 96px PNG와 꼭 맞게 잘린 GIF가 다르다. */
  anchorY: number;
};

/** PokéRogue 포켓몬 스프라이트는 프레임 이름 순서대로 10fps로 재생한다. */
export const POKEMON_SPRITE_FRAME_MS = 100;

/**
 * 공격 측(왼쪽 아래)은 뒷모습, 방어 측(오른쪽 위)은 앞모습을 쓴다.
 * PokéRogue 스프라이트(원작과 같은 픽셀 크기) → PokeAPI 애니메이션 GIF → 정적 PNG → 원래 이미지 순으로 내려간다.
 */
export function battleSpriteCandidates(imagePath: string, side: "attacker" | "defender"): SpriteCandidate[] {
  const original: SpriteCandidate = { url: imagePath, animated: false, flip: side === "attacker", anchorY: 0.82 };
  const match = POKEAPI_PNG.exec(imagePath);
  if (!match) return [original];
  const no = match[1];
  const folder = side === "attacker" ? "pokemon/back" : "pokemon";
  const pokerogue: SpriteCandidate = { url: `${POKEROGUE_IMAGES}/${folder}/${no}.png`, atlas: `${POKEROGUE_IMAGES}/${folder}/${no}.json`, animated: true, flip: false, anchorY: 1 };
  return side === "attacker"
    ? [
        pokerogue,
        { url: `${POKEAPI_SPRITES}/other/showdown/back/${no}.gif`, animated: true, flip: false, anchorY: 0.98 },
        { url: `${POKEAPI_SPRITES}/back/${no}.png`, animated: false, flip: false, anchorY: 0.86 },
        original,
      ]
    : [pokerogue, { url: `${POKEAPI_SPRITES}/other/showdown/${no}.gif`, animated: true, flip: false, anchorY: 0.98 }, original];
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

/**
 * PokéRogue 전투 화면: 320×180 필드에 배경(bg)과 발판(a: 플레이어, b: 상대, 320×132)을 왼쪽 위에 맞춰 겹치고,
 * 아래 48픽셀은 메시지창이 덮는다. 장면을 이 크기로 그린 뒤 최근접 보간으로 확대해 원작과 같은 픽셀 밀도로 보여준다.
 */
export const FIELD = { width: 320, height: 180, messageHeight: 48 } as const;
/** 포켓몬 발 위치(필드 좌표). PokéRogue 기본 자리와 같다(내 포켓몬은 발이 메시지창에 가려진다). */
export const FIELD_SPOTS = { attacker: { x: 106, y: 148 }, defender: { x: 236, y: 84 } } as const;

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

/**
 * 타입별로 무작위로 고를 PokéRogue 기술(battle-anims JSON 이름). 공격 단계 안에 끝나도록 36프레임 이하인 공격 기술만 골랐다.
 * 기술 JSON은 PokéRogue 저장소에서 AGPL-3.0으로 분류된다. 런타임에만 불러오고 저장소에는 복사하지 않는다.
 */
export const MOVE_POOLS: Record<BattleType, readonly (readonly [move: string, frames: number])[]> = {
  normal: [["tackle", 6], ["scratch", 7], ["quick-attack", 13], ["body-slam", 14], ["headbutt", 15], ["pound", 8], ["slash", 14], ["hyper-fang", 14]],
  fire: [["ember", 14], ["flamethrower", 18], ["flame-wheel", 24], ["fire-punch", 14], ["fire-fang", 16], ["heat-wave", 29], ["flame-charge", 33]],
  water: [["water-gun", 16], ["bubble", 29], ["bubble-beam", 30], ["hydro-pump", 27], ["aqua-tail", 16], ["water-pulse", 22], ["aqua-jet", 17]],
  electric: [["thunder-shock", 19], ["thunderbolt", 26], ["thunder-punch", 24], ["spark", 22], ["shock-wave", 31], ["discharge", 35], ["thunder-fang", 14]],
  grass: [["vine-whip", 13], ["razor-leaf", 29], ["magical-leaf", 28], ["leaf-blade", 24], ["seed-bomb", 17], ["bullet-seed", 14], ["absorb", 19]],
  ice: [["ice-beam", 27], ["ice-punch", 17], ["powder-snow", 19], ["ice-shard", 19], ["aurora-beam", 29], ["icy-wind", 17], ["ice-fang", 12], ["blizzard", 30]],
  fighting: [["karate-chop", 14], ["low-kick", 13], ["double-kick", 5], ["mach-punch", 10], ["brick-break", 34], ["cross-chop", 19], ["rock-smash", 17], ["focus-punch", 28]],
  poison: [["poison-sting", 25], ["sludge", 21], ["sludge-bomb", 29], ["poison-jab", 18], ["acid", 19], ["smog", 17], ["poison-fang", 21]],
  ground: [["mud-slap", 17], ["mud-shot", 29], ["bone-club", 20], ["bonemerang", 15], ["bulldoze", 19], ["drill-run", 35]],
  flying: [["gust", 25], ["wing-attack", 13], ["peck", 9], ["aerial-ace", 13], ["air-slash", 24], ["drill-peck", 22], ["air-cutter", 14], ["pluck", 14]],
  psychic: [["confusion", 28], ["psybeam", 24], ["psychic", 24], ["psycho-cut", 19], ["zen-headbutt", 15], ["psyshock", 24]],
  bug: [["bug-bite", 20], ["x-scissor", 34], ["signal-beam", 20], ["bug-buzz", 33], ["fury-cutter", 7], ["pin-missile", 15], ["twineedle", 22], ["leech-life", 21]],
  rock: [["rock-throw", 24], ["rock-slide", 32], ["power-gem", 19], ["ancient-power", 33], ["rock-blast", 9], ["stone-edge", 34], ["head-smash", 13]],
  ghost: [["lick", 14], ["shadow-claw", 11], ["shadow-punch", 16], ["night-shade", 23], ["shadow-sneak", 32], ["astonish", 11], ["hex", 27]],
  dragon: [["dragon-breath", 14], ["dragon-claw", 17], ["twister", 29], ["dragon-rage", 22], ["outrage", 27], ["dragon-tail", 19], ["dual-chop", 9]],
  fairy: [["fairy-wind", 34], ["draining-kiss", 17], ["disarming-voice", 17]],
  steel: [["metal-claw", 14], ["iron-tail", 20], ["iron-head", 15], ["bullet-punch", 9], ["steel-wing", 23], ["magnet-bomb", 21], ["mirror-shot", 19]],
};

const POKEROGUE_ROOT = "https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta";

/** PokéRogue는 기술 애니메이션 한 프레임을 50ms(60fps 기준 3프레임)로 재생한다. */
export const MOVE_FRAME_MS = 50;

export function movePool(type: string): readonly string[] {
  return MOVE_POOLS[(Object.hasOwn(MOVE_POOLS, type) ? type : "normal") as BattleType].map(([move]) => move);
}

/** 기술 재생 길이(ms). 공격 단계 길이를 이 값에 맞춘다. */
export function moveDurationMs(move: string) {
  for (const pool of Object.values(MOVE_POOLS)) for (const [name, frames] of pool) if (name === move) return frames * MOVE_FRAME_MS;
  return 0;
}

/** 공격마다 그 타입의 기술 하나를 무작위로 고른다(random은 테스트에서 바꿀 수 있다). */
export function randomMove(type: string, random: () => number = Math.random) {
  const pool = movePool(type);
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

export const moveAnimUrl = (move: string) => `${POKEROGUE_ROOT}/battle-anims/${encodeURIComponent(move)}.json`;
export const moveGraphicUrl = (graphic: string) => `${POKEROGUE_ANIMS}/${encodeURIComponent(graphic)}.png`;
export const moveSoundUrl = (resource: string) => `${POKEROGUE_AUDIO}/battle_anims/${encodeURIComponent(resource)}`;

/** 기술 한국어 이름(PokeAPI 기술 데이터의 ko 이름). */
const MOVE_NAMES_KO: Record<string, string> = {
  "absorb": "흡수",
  "acid": "용해액",
  "aerial-ace": "제비반환",
  "air-cutter": "에어커터",
  "air-slash": "에어슬래시",
  "ancient-power": "원시의힘",
  "aqua-jet": "아쿠아제트",
  "aqua-tail": "아쿠아테일",
  "astonish": "놀래키기",
  "aurora-beam": "오로라빔",
  "blizzard": "눈보라",
  "body-slam": "누르기",
  "bone-club": "뼈다귀치기",
  "bonemerang": "뼈다귀부메랑",
  "brick-break": "깨뜨리다",
  "bubble": "거품",
  "bubble-beam": "거품광선",
  "bug-bite": "벌레먹기",
  "bug-buzz": "벌레의야단법석",
  "bulldoze": "땅고르기",
  "bullet-punch": "불릿펀치",
  "bullet-seed": "씨기관총",
  "confusion": "염동력",
  "cross-chop": "크로스촙",
  "disarming-voice": "차밍보이스",
  "discharge": "방전",
  "double-kick": "두번차기",
  "dragon-breath": "용의숨결",
  "dragon-claw": "드래곤클로",
  "dragon-rage": "용의분노",
  "dragon-tail": "드래곤테일",
  "draining-kiss": "드레인키스",
  "drill-peck": "회전부리",
  "drill-run": "드릴라이너",
  "dual-chop": "더블촙",
  "ember": "불꽃세례",
  "fairy-wind": "요정의바람",
  "fire-fang": "불꽃엄니",
  "fire-punch": "불꽃펀치",
  "flame-charge": "니트로차지",
  "flame-wheel": "화염바퀴",
  "flamethrower": "화염방사",
  "focus-punch": "힘껏펀치",
  "fury-cutter": "연속자르기",
  "gust": "바람일으키기",
  "head-smash": "양날박치기",
  "headbutt": "박치기",
  "heat-wave": "열풍",
  "hex": "병상첨병",
  "hydro-pump": "하이드로펌프",
  "hyper-fang": "필살앞니",
  "ice-beam": "냉동빔",
  "ice-fang": "얼음엄니",
  "ice-punch": "냉동펀치",
  "ice-shard": "얼음뭉치",
  "icy-wind": "얼어붙은바람",
  "iron-head": "아이언헤드",
  "iron-tail": "아이언테일",
  "karate-chop": "태권당수",
  "leaf-blade": "리프블레이드",
  "leech-life": "흡혈",
  "lick": "핥기",
  "low-kick": "안다리걸기",
  "mach-punch": "마하펀치",
  "magical-leaf": "매지컬리프",
  "magnet-bomb": "마그넷봄",
  "metal-claw": "메탈클로",
  "mirror-shot": "미러샷",
  "mud-shot": "머드샷",
  "mud-slap": "진흙뿌리기",
  "night-shade": "나이트헤드",
  "outrage": "역린",
  "peck": "쪼기",
  "pin-missile": "바늘미사일",
  "pluck": "쪼아대기",
  "poison-fang": "맹독엄니",
  "poison-jab": "독찌르기",
  "poison-sting": "독침",
  "pound": "막치기",
  "powder-snow": "눈싸라기",
  "power-gem": "파워젬",
  "psybeam": "환상빔",
  "psychic": "사이코키네시스",
  "psycho-cut": "사이코커터",
  "psyshock": "사이코쇼크",
  "quick-attack": "전광석화",
  "razor-leaf": "잎날가르기",
  "rock-blast": "록블라스트",
  "rock-slide": "스톤샤워",
  "rock-smash": "바위깨기",
  "rock-throw": "돌떨구기",
  "scratch": "할퀴기",
  "seed-bomb": "씨폭탄",
  "shadow-claw": "섀도클로",
  "shadow-punch": "섀도펀치",
  "shadow-sneak": "야습",
  "shock-wave": "전격파",
  "signal-beam": "시그널빔",
  "slash": "베어가르기",
  "sludge": "오물공격",
  "sludge-bomb": "오물폭탄",
  "smog": "스모그",
  "spark": "스파크",
  "steel-wing": "강철날개",
  "stone-edge": "스톤에지",
  "tackle": "몸통박치기",
  "thunder-fang": "번개엄니",
  "thunder-punch": "번개펀치",
  "thunder-shock": "전기쇼크",
  "thunderbolt": "10만볼트",
  "twineedle": "더블니들",
  "twister": "회오리",
  "vine-whip": "덩굴채찍",
  "water-gun": "물대포",
  "water-pulse": "물의파동",
  "wing-attack": "날개치기",
  "x-scissor": "시저크로스",
  "zen-headbutt": "사념의박치기",
};

export function moveDisplayName(move: string) {
  return MOVE_NAMES_KO[move] ?? move;
}
