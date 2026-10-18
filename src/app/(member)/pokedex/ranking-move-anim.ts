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
  /** 0: 포켓몬 앞, 1: 맨 앞, 2: 기준 포켓몬 뒤(배경이 있으면 배경 바로 위), 3: 기준 포켓몬 바로 앞 */
  priority: number;
  /** 포켓몬 색조 [더할 R, G, B(-255~255), 회색 정도(0~255)] */
  tone: readonly [number, number, number, number];
};

/** 배경 이벤트: add는 타일 배경을 새로 깔고, update는 위치·투명도를 duration 프레임 동안 바꾼다. */
export type MoveBgEvent = { frame: number; kind: "add" | "update"; resource: string; bgX: number; bgY: number; opacity: number; duration: number };

export type MoveAnim = {
  graphic: string;
  frames: MoveElement[][];
  sounds: { frame: number; resource: string; volume: number; pitch: number }[];
  backgrounds: MoveBgEvent[];
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
      priority: finite(element.priority, 1),
      tone: Array.isArray(element.tone) ? [finite(element.tone[0], 0), finite(element.tone[1], 0), finite(element.tone[2], 0), finite(element.tone[3], 0)] as const : [0, 0, 0, 0] as const,
    }];
  }) : []);
  const sounds: MoveAnim["sounds"] = [];
  const backgrounds: MoveBgEvent[] = [];
  if (source.frameTimedEvents && typeof source.frameTimedEvents === "object") {
    for (const [key, events] of Object.entries(source.frameTimedEvents as Record<string, unknown>)) {
      if (!Array.isArray(events)) continue;
      const frame = Math.max(0, Math.floor(Number(key) || 0));
      for (const event of events) {
        const value = event as Record<string, unknown>;
        if (!value || typeof value.resourceName !== "string") continue;
        if (value.eventType === "AnimTimedSoundEvent" && value.resourceName) sounds.push({ frame, resource: value.resourceName, volume: Math.max(0, Math.min(1, finite(value.volume, 100) / 100)), pitch: Math.max(0.25, Math.min(4, finite(value.pitch, 100) / 100)) });
        if (value.eventType === "AnimTimedAddBgEvent" || value.eventType === "AnimTimedUpdateBgEvent") {
          backgrounds.push({ frame, kind: value.eventType === "AnimTimedAddBgEvent" ? "add" : "update", resource: value.resourceName, bgX: finite(value.bgX, 0), bgY: finite(value.bgY, 0), opacity: Math.max(0, Math.min(255, finite(value.opacity, 0))), duration: Math.max(0, finite(value.duration, 0)) });
        }
      }
    }
  }
  return { graphic: typeof source.graphic === "string" ? source.graphic : "", frames, sounds, backgrounds };
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

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/**
 * 프레임 사이를 부드럽게 잇는다. PokéRogue처럼 같은 종류(시전자·대상·이펙트) 안에서 순서가 같은 요소끼리 짝짓고,
 * 위치·확대·투명도·회전만 보간한다(셀 번호·색조는 현재 프레임 값을 쓴다).
 */
export function interpolateFrame(current: MoveElement[], next: MoveElement[] | undefined, t: number): MoveElement[] {
  if (!next || t <= 0) return current;
  const counters = new Map<number, number>();
  const nextByKind = new Map<number, MoveElement[]>();
  for (const element of next) nextByKind.set(element.target, [...(nextByKind.get(element.target) ?? []), element]);
  return current.map((element) => {
    const order = counters.get(element.target) ?? 0;
    counters.set(element.target, order + 1);
    const pair = nextByKind.get(element.target)?.[order];
    if (!pair || pair.focus !== element.focus || !pair.visible || !element.visible) return element;
    return { ...element, x: lerp(element.x, pair.x, t), y: lerp(element.y, pair.y, t), zoomX: lerp(element.zoomX, pair.zoomX, t), zoomY: lerp(element.zoomY, pair.zoomY, t), opacity: lerp(element.opacity, pair.opacity, t), angle: lerp(element.angle, pair.angle, t) };
  });
}

/** PokéRogue 색조 셰이더와 같은 계산(회색 섞기 후 RGB 더하기)을 ColorMatrixFilter 행렬(4×5, 오프셋 0~1)로 만든다. */
export function toneMatrix(tone: readonly [number, number, number, number]) {
  const gray = Math.max(0, Math.min(1, tone[3] / 255));
  const luma = [0.299, 0.587, 0.114];
  const row = (channel: number, offset: number) => [0, 1, 2].map((index) => (1 - gray) * (index === channel ? 1 : 0) + gray * luma[index]).concat([0, offset]);
  return [...row(0, tone[0] / 255), ...row(1, tone[1] / 255), ...row(2, tone[2] / 255), 0, 0, 0, 1, 0];
}

export const hasTone = (tone: readonly number[]) => tone.some((value) => value !== 0);
