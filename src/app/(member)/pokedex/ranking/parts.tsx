"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { timeUntilRefresh } from "@/lib/pokedex/ranking-stats";

/** 히어로는 두 테마 모두 어두우므로 그 안에서는 고정 알파 흰색을 쓴다. */
export const onHero = (alpha: number) => `rgba(247,247,248,${alpha})`;

export function PokemonImage({ src, size, alt = "", style }: { src: string; size: number; alt?: string; style?: CSSProperties }) {
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain", imageRendering: "pixelated", ...style }}
    />
  );
}

/** 오늘 남은 공격 칸. */
export function Pips({ left, total, hero = false }: { left: number; total: number; hero?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 6 }} aria-label={`남은 공격 ${left}/${total}`}>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          style={{
            width: 30,
            height: 8,
            borderRadius: 999,
            background: index < left
              ? hero ? "var(--rk-hero-primary)" : "var(--rk-primary)"
              : hero ? "rgba(247,247,248,.16)" : "var(--rk-fill-strong)",
          }}
        />
      ))}
    </div>
  );
}

export function medalStyle(rank: number): CSSProperties {
  const background = rank === 1 ? "rgba(255,153,0,.16)" : rank === 2 ? "rgba(112,115,124,.16)" : "rgba(180,120,60,.16)";
  const color = rank === 1 ? "var(--rk-warn)" : rank === 2 ? "var(--rk-text-1)" : "rgb(190,130,70)";
  return { width: 24, height: 24, borderRadius: 999, background, color, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" };
}

export const TONE = {
  positive: { fg: "var(--rk-pos-fg)", bg: "rgba(0,191,64,.12)", dot: "var(--rk-pos)" },
  neutral: { fg: "var(--rk-text-1)", bg: "var(--rk-fill)", dot: "var(--rk-text-3)" },
  negative: { fg: "var(--rk-neg-fg)", bg: "rgba(255,66,66,.12)", dot: "var(--rk-neg)" },
} as const;

/**
 * 저장된 전투 기록에서 복원한 점수 추이. 좌표는 값에서 계산하므로
 * 기록이 늘어도 그래프가 따라간다.
 */
export function ScoreChart({ values, height = 150, grid = 2 }: { values: number[]; height?: number; grid?: number }) {
  if (values.length < 2) return <p style={{ fontSize: 13, color: "var(--rk-text-2)" }}>전투를 치르면 점수 추이가 그려져요.</p>;
  const [width, box, padX, padTop, padBottom] = [640, 160, 24, 24, 30];
  const [low, high] = [Math.min(...values), Math.max(...values)];
  const span = high - low || 1;
  const points = values.map((value, index) => {
    const x = padX + (index * (width - padX * 2)) / (values.length - 1);
    const y = padTop + (1 - (value - low) / span) * (box - padTop - padBottom);
    return [x, y] as const;
  });
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${box}`} style={{ width: "100%", height, display: "block" }} preserveAspectRatio="none" role="img" aria-label={`점수 추이, 최근 ${values[values.length - 1]}점`}>
      {Array.from({ length: grid }, (_, index) => {
        const y = padTop + ((index + 1) * (box - padTop - padBottom)) / (grid + 1);
        return <line key={index} x1={0} y1={y} x2={width} y2={y} stroke="var(--rk-line)" strokeWidth={1} strokeDasharray="4 5" />;
      })}
      <polygon points={`${line} ${last[0].toFixed(1)},${box - 8} ${points[0][0].toFixed(1)},${box - 8}`} fill="var(--rk-primary)" opacity={0.1} />
      <polyline points={line} fill="none" stroke="var(--rk-primary)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r={10} fill="var(--rk-primary)" opacity={0.18} />
      <circle cx={last[0]} cy={last[1]} r={5} fill="var(--rk-primary)" />
    </svg>
  );
}

/** 다음 상대 갱신까지 남은 시간. 서버 렌더와 어긋나지 않게 마운트 뒤에 채운다. */
export function useRefreshCountdown() {
  const [text, setText] = useState("--:--:--");
  useEffect(() => {
    const tick = () => setText(timeUntilRefresh(Date.now()));
    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return text;
}
