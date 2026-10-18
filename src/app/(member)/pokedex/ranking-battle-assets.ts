// 랭킹전 전투장이 런타임에 불러오는 외부 이미지 주소.
// 저장소에는 파일을 넣지 않고 URL만 둔다. 출처·라이선스는 docs/policy/pokedex-ranking-battle-animation.md에 적는다.
// 모든 주소는 CORS(access-control-allow-origin: *)를 확인했고, 실패하면 기존 정적 이미지·Graphics 연출로 돌아간다.
import type { BattleMotion } from "@/lib/pokedex/battle-effects";

const POKEAPI_SPRITES = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
const POKEAPI_PNG = /^https:\/\/raw\.githubusercontent\.com\/PokeAPI\/sprites\/master\/sprites\/pokemon\/(\d+)\.png$/;
const POKEROGUE_IMAGES = "https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/images";
const POKEROGUE_ANIMS = `${POKEROGUE_IMAGES}/battle_anims`;

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
  flame: { impact: sheet("PRAS- Fire.png", range(6, 13), 55) },
  splash: { impact: sheet("PRAS- Water.png", range(31, 39), 50) },
  bolt: { impact: sheet("PRAS- Electric.png", range(0, 9), 45) },
  leaf: { projectile: sheet("PRAS- Magical Leaf.png", range(4, 12), 60), impact: sheet("PRAS- Magical Leaf.png", [13, 14, 13, 14], 70) },
  strike: { impact: sheet("Tackle_B.png", [0], 60) },
  wave: { projectile: sheet("PRAS- Psybeam.png", range(0, 3), 70) },
};

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
