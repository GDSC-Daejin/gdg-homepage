"use client";

import type { CSSProperties } from "react";
import { SPRITE } from "./preview-data";

/**
 * 시안 재현에 필요한 작은 조각들.
 * WDS Icon에는 시안이 쓰는 아이콘(불꽃·북마크·티켓·화살표…)이 없어서 여기에 최소한만 그렸다.
 */

const GLYPHS = {
  fire: "M12 2c1.4 3.3-.9 4.9-.9 6.9a2.9 2.9 0 0 0 5.8 0c0-.9-.3-1.8-.8-2.6C18.8 8.3 20 10.9 20 13.4a8 8 0 1 1-16 0C4 8.6 8.4 6 12 2Z",
  bookmark: "M6.5 3.5h11v17l-5.5-3.7-5.5 3.7z",
  ticket: "M3.5 8.5a1.5 1.5 0 0 1 1.5-1.5h14a1.5 1.5 0 0 1 1.5 1.5v1.8a2 2 0 0 0 0 3.4v1.8a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-1.8a2 2 0 0 0 0-3.4z",
  check: "m20 6.5-10.5 11L4 12",
  "chevron-right": "m9.5 5.5 6.5 6.5-6.5 6.5",
  home: "M4 10.2 12 3.5l8 6.7V20a.8.8 0 0 1-.8.8h-4.4V15h-5.6v5.8H4.8A.8.8 0 0 1 4 20z",
  deck: "M4.5 8.5h7v12h-7zM13.5 5.5h6v15h-6z",
  rank: "M4.5 19.5h15M7 19.5v-6h3.5v6zM14 19.5V8.5h3.5v11z",
} as const;

export type GlyphName = keyof typeof GLYPHS;

export function Glyph({ name, size = 20, style }: { name: GlyphName; size?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" style={style}>
      <path d={GLYPHS[name]} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Sprite({ no, size, alt = "", style }: { no: number; size: number; alt?: string; style?: CSSProperties }) {
  return (
    <img
      src={SPRITE(no)}
      alt={alt}
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain", imageRendering: "pixelated", ...style }}
    />
  );
}

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

/** 오늘 남은 공격 표시. total 칸 중 left 칸이 채워진다. */
export function Pips({ left, total, dark = false }: { left: number; total: number; dark?: boolean }) {
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
              ? dark ? "var(--wds-inverse-primary)" : "var(--wds-primary)"
              : dark ? "rgba(247,247,248,.16)" : "var(--wds-fill-strong)",
          }}
        />
      ))}
    </div>
  );
}

export function medalStyle(rank: number): CSSProperties {
  const background = rank === 1 ? "rgba(255,153,0,.16)" : rank === 2 ? "rgba(112,115,124,.12)" : "rgba(180,120,60,.14)";
  const color = rank === 1 ? "rgb(190,110,0)" : rank === 2 ? "var(--wds-label-neutral)" : "rgb(150,95,40)";
  return { width: 24, height: 24, borderRadius: 999, background, color, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" };
}

export const TONE = {
  pos: { fg: "rgb(0,150,52)", bg: "rgba(0,191,64,.10)", dot: "rgb(0,191,64)" },
  neu: { fg: "var(--wds-label-neutral)", bg: "rgba(112,115,124,.08)", dot: "rgba(112,115,124,.5)" },
  neg: { fg: "rgb(226,52,52)", bg: "rgba(255,66,66,.09)", dot: "rgb(255,66,66)" },
} as const;

/**
 * 점수 추이 꺾은선. 시안은 좌표가 박혀 있었지만 값에서 계산해 그린다 —
 * 데이터가 바뀌어도 그래프가 따라간다.
 */
export function ScoreChart({ values, height = 150, grid = 2 }: { values: number[]; height?: number; grid?: number }) {
  const width = 640;
  const box = 160;
  const padX = 24;
  const padTop = 24;
  const padBottom = 30;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = padX + (index * (width - padX * 2)) / Math.max(1, values.length - 1);
    const y = padTop + (1 - (value - min) / span) * (box - padTop - padBottom);
    return [x, y] as const;
  });
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} ${points[points.length - 1][0].toFixed(1)},${box - 8} ${points[0][0].toFixed(1)},${box - 8}`;
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${box}`} style={{ width: "100%", height, display: "block" }} preserveAspectRatio="none" aria-hidden>
      {Array.from({ length: grid }, (_, index) => {
        const y = padTop + ((index + 1) * (box - padTop - padBottom)) / (grid + 1);
        return <line key={index} x1={0} y1={y} x2={width} y2={y} stroke="rgba(112,115,124,.14)" strokeWidth={1} strokeDasharray="4 5" />;
      })}
      <polygon points={area} fill="rgba(0,102,255,.09)" />
      <polyline points={line} fill="none" stroke="var(--wds-primary)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r={10} fill="rgba(0,102,255,.16)" />
      <circle cx={last[0]} cy={last[1]} r={5.5} fill="var(--wds-primary)" />
    </svg>
  );
}

export const won = (value: number) => `${value > 0 ? "+" : ""}${value}`;
