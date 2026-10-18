// 랭킹전 전투 연출의 순수 계산. 서버 확정 결과(피해·승패)는 읽기만 하고 바꾸지 않는다.

export type ImpactTier = "strong" | "normal" | "weak";

export type ImpactProfile = {
  tier: ImpactTier;
  /** 명중 직후 화면을 멈추는 시간(재생 시간 기준 ms) */
  hitstop: number;
  /** 카메라 흔들림 진폭(px) */
  shake: number;
  /** 피격 넉백 거리(px) */
  knockback: number;
  /** 파티클·링 크기 배율 */
  burst: number;
  /** 화면 전체 흰색 플래시 강도(0~1) */
  screenFlash: number;
};

export function impactTier(multiplier: number): ImpactTier {
  return multiplier > 1 ? "strong" : multiplier < 1 ? "weak" : "normal";
}

export function impactProfile(multiplier: number): ImpactProfile {
  const tier = impactTier(multiplier);
  if (tier === "strong") return { tier, hitstop: 120, shake: 8, knockback: 15, burst: 1.6, screenFlash: 0.22 };
  if (tier === "weak") return { tier, hitstop: 40, shake: 0, knockback: 8, burst: 0.5, screenFlash: 0 };
  return { tier, hitstop: 80, shake: 3, knockback: 12, burst: 1, screenFlash: 0 };
}

/** 좁은 화면은 해상도와 파티클 수를 낮춰 프레임을 지킨다. */
export function sceneQuality(width: number, devicePixelRatio: number) {
  const compact = width < 640;
  return {
    compact,
    resolution: compact ? 1 : Math.min(devicePixelRatio || 1, 2),
    maxParticles: compact ? 48 : 140,
    particleScale: compact ? 0.5 : 1,
  };
}

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
export const easeOutCubic = (t: number) => 1 - (1 - clamp01(t)) ** 3;
export const easeInCubic = (t: number) => clamp01(t) ** 3;
export const easeOutBack = (t: number) => {
  const x = clamp01(t) - 1;
  return 1 + 2.4 * x ** 3 + 1.4 * x ** 2;
};
/** 구간 [start, end] 안에서의 진행률 */
export const segment = (t: number, start: number, end: number) => clamp01((t - start) / (end - start));

export function healthPercent(health: number, maximum: number) {
  return Math.max(0, Math.min(100, health / maximum * 100));
}

/** 체력 비율에 따른 HP 바 색(초록 → 노랑 → 빨강) */
export function healthColor(percent: number) {
  return percent > 50 ? "#22c55e" : percent > 20 ? "#facc15" : "#ef4444";
}
