// PokéRogue 기술 애니메이션(battle-anims JSON)을 읽어 재생하기 위한 순수 계산.
// JSON은 저장소에 두지 않고 런타임에 받아 해석만 한다(라이선스: docs/policy/pokedex-ranking-battle-animation.md).
// 좌표 규칙은 PokéRogue 재생 방식과 같게 맞췄다: 320×180 필드에서 시전자 기준점 (106,116), 대상 기준점 (234,52).

export type MoveElement = {
  x: number;
  y: number;
  zoomX: number;
  zoomY: number;
  visible: boolean;
  /** 0: 시전자, 1: 대상, 2: 이펙트 셀 */
  target: number;
  /** 1: 대상 기준, 2: 시전자 기준, 3: 시전자→대상 사이 보간, 4: 화면 고정 */
  focus: number;
  graphicFrame: number;
  opacity: number;
  /** 0: 보통, 1: 더하기, 2: 차이 */
  blendType: number;
  angle: number;
  mirror: boolean;
};

export type MoveAnim = {
  graphic: string;
  frames: MoveElement[][];
  sounds: { frame: number; resource: string; volume: number }[];
};

/** 기본 변형과, 위쪽(상대) 포켓몬이 쓸 때의 전용 변형(있을 때만) */
export type MoveAnimSet = { main: MoveAnim; opponent: MoveAnim | null };

export const FIELD_USER_FOCUS = { x: 106, y: 116 } as const;
export const FIELD_TARGET_FOCUS = { x: 234, y: 52 } as const;

const finite = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? value : fallback;

function parseVariant(raw: unknown): MoveAnim | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as { graphic?: unknown; frames?: unknown; frameTimedEvents?: unknown };
  if (!Array.isArray(source.frames) || !source.frames.length) return null;
  const frames = source.frames.map((frame) => Array.isArray(frame) ? frame.flatMap((item): MoveElement[] => {
    if (!item || typeof item !== "object") return [];
    const element = item as Record<string, unknown>;
    return [{
      x: finite(element.x, 0),
      y: finite(element.y, 0),
      zoomX: finite(element.zoomX, 100),
      zoomY: finite(element.zoomY, 100),
      visible: element.visible !== false,
      target: finite(element.target, 2),
      focus: finite(element.focus, 1),
      graphicFrame: Math.max(0, Math.floor(finite(element.graphicFrame, 0))),
      opacity: Math.max(0, Math.min(255, finite(element.opacity, 255))),
      blendType: finite(element.blendType, 0),
      angle: finite(element.angle, 0),
      mirror: element.mirror === true,
    }];
  }) : []);
  const sounds: MoveAnim["sounds"] = [];
  if (source.frameTimedEvents && typeof source.frameTimedEvents === "object") {
    for (const [frame, events] of Object.entries(source.frameTimedEvents as Record<string, unknown>)) {
      if (!Array.isArray(events)) continue;
      for (const event of events) {
        const value = event as Record<string, unknown>;
        if (value?.eventType !== "AnimTimedSoundEvent" || typeof value.resourceName !== "string") continue;
        sounds.push({ frame: Math.max(0, Math.floor(Number(frame) || 0)), resource: value.resourceName, volume: Math.max(0, Math.min(1, finite(value.volume, 100) / 100)) });
      }
    }
  }
  return { graphic: typeof source.graphic === "string" ? source.graphic : "", frames, sounds };
}

/** 기술 JSON을 해석한다. 배열이면 [0]이 기본, [1]이 상대 시전용이다. 형식이 맞지 않으면 null. */
export function parseMoveAnim(raw: unknown): MoveAnimSet | null {
  if (Array.isArray(raw)) {
    const main = parseVariant(raw[0]);
    return main ? { main, opponent: raw.length > 1 ? parseVariant(raw[1]) : null } : null;
  }
  const main = parseVariant(raw);
  return main ? { main, opponent: null } : null;
}

export type Point = { x: number; y: number };

/**
 * 프레임 요소 하나의 화면 위치와 좌우 반전 여부.
 * - 대상·시전자 기준: 필드 픽셀 그대로 옮긴다(배율 fieldScale).
 * - 보간: 기준점 사이 비율을 실제 두 포켓몬 중심 사이에 적용하고, 방향이 뒤집히면 이펙트도 뒤집는다.
 * - 화면 고정: 필드 좌표를 그대로 화면에 놓는다.
 */
export function placeMoveElement(element: Pick<MoveElement, "x" | "y" | "focus" | "target">, user: Point, target: Point, field: { x: number; y: number; scale: number }) {
  const fx = element.x + FIELD_USER_FOCUS.x;
  const fy = element.y + FIELD_USER_FOCUS.y;
  if (element.focus === 1) return { x: target.x + (fx - FIELD_TARGET_FOCUS.x) * field.scale, y: target.y + (fy - FIELD_TARGET_FOCUS.y) * field.scale, flip: false };
  if (element.focus === 2) return { x: user.x + (fx - FIELD_USER_FOCUS.x) * field.scale, y: user.y + (fy - FIELD_USER_FOCUS.y) * field.scale, flip: false };
  if (element.focus === 3) {
    const tx = (fx - FIELD_USER_FOCUS.x) / (FIELD_TARGET_FOCUS.x - FIELD_USER_FOCUS.x);
    const ty = (fy - FIELD_USER_FOCUS.y) / (FIELD_TARGET_FOCUS.y - FIELD_USER_FOCUS.y);
    return { x: user.x + tx * (target.x - user.x), y: user.y + ty * (target.y - user.y), flip: element.target === 2 && user.x > target.x };
  }
  return { x: field.x + fx * field.scale, y: field.y + fy * field.scale, flip: false };
}
