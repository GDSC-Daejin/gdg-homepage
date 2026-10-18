// PokéRogue 기술 애니메이션(battle-anims JSON)을 읽어 재생하기 위한 순수 계산.
// JSON은 저장소에 두지 않고 런타임에 받아 해석만 한다(라이선스: docs/policy/pokedex-ranking-battle-animation.md).

export type MoveElement = {
  x: number;
  y: number;
  zoomX: number;
  zoomY: number;
  visible: boolean;
  /** 0: 시전자, 1: 대상, 2: 이펙트 셀 */
  target: number;
  graphicFrame: number;
  opacity: number;
  blendType: number;
  angle: number;
  mirror: boolean;
};

export type MoveAnim = {
  graphic: string;
  frames: MoveElement[][];
  sounds: { frame: number; resource: string; volume: number }[];
};

/** 애니메이션 좌표계에서 시전자와 대상의 기준 위치 */
export const ANIM_USER = { x: 0, y: 0 } as const;
export const ANIM_TARGET = { x: 128, y: -64 } as const;

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

/**
 * 기술 JSON을 해석한다. 배열이면 [0]이 아래쪽(플레이어) 시전, [1]이 위쪽(상대) 시전용이다.
 * 형식이 맞지 않으면 null을 돌려 기본 연출로 대체한다.
 */
export function parseMoveAnim(raw: unknown, fromTopSide: boolean): MoveAnim | null {
  if (Array.isArray(raw)) return parseVariant(fromTopSide && raw[1] ? raw[1] : raw[0]) ?? parseVariant(raw[0]);
  return parseVariant(raw);
}

/**
 * 애니메이션 좌표를 화면 좌표로 바꾼다. 시전자(0,0)→user, 대상(128,-64)→target에 맞춰 축마다 선형 변환한다.
 * 위쪽에서 아래쪽으로 공격하면 자동으로 좌우·상하가 뒤집힌다.
 */
export function mapAnimPoint(x: number, y: number, user: { x: number; y: number }, target: { x: number; y: number }) {
  return {
    x: user.x + (x - ANIM_USER.x) / (ANIM_TARGET.x - ANIM_USER.x) * (target.x - user.x),
    y: user.y + (y - ANIM_USER.y) / (ANIM_TARGET.y - ANIM_USER.y) * (target.y - user.y),
  };
}

/** 기술이 공격 단계가 끝날 무렵(명중 직전) 끝나도록 프레임 간격을 정한다. */
export function moveFrameMs(frameCount: number, windowMs: number) {
  return Math.max(22, Math.min(50, windowMs / Math.max(frameCount, 1)));
}
