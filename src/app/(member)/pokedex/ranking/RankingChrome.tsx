"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";

/**
 * 랭킹전 4페이지 내비게이션. 데스크톱은 상단 탭, 모바일은 하단 고정 탭이다.
 * 도감 탭바와 겹치지 않도록 랭킹전은 자체 라우트를 쓰고, 여기가 유일한 탭이 된다.
 */

const GLYPHS = {
  home: "M4 10.2 12 3.5l8 6.7V20a.8.8 0 0 1-.8.8h-4.4V15h-5.6v5.8H4.8A.8.8 0 0 1 4 20z",
  fire: "M12 2c1.4 3.3-.9 4.9-.9 6.9a2.9 2.9 0 0 0 5.8 0c0-.9-.3-1.8-.8-2.6C18.8 8.3 20 10.9 20 13.4a8 8 0 1 1-16 0C4 8.6 8.4 6 12 2Z",
  deck: "M4.5 8.5h7v12h-7zM13.5 5.5h6v15h-6z",
  log: "M4.5 19.5h15M7 19.5v-6h3.5v6zM14 19.5V8.5h3.5v11z",
} as const;

export const RANKING_TABS: { href: string; label: string; short: string; icon: keyof typeof GLYPHS }[] = [
  { href: "/pokedex/ranking", label: "랭킹전 홈", short: "홈", icon: "home" },
  { href: "/pokedex/ranking/attack", label: "공격", short: "공격", icon: "fire" },
  { href: "/pokedex/ranking/deck", label: "내 덱", short: "내 덱", icon: "deck" },
  { href: "/pokedex/ranking/log", label: "기록", short: "기록", icon: "log" },
];

function Glyph({ name, size = 22, style }: { name: keyof typeof GLYPHS; size?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" style={style}>
      <path d={GLYPHS[name]} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 가장 긴 접두사가 이긴다 — `/pokedex/ranking`이 `/pokedex/ranking/attack`을 삼키지 않게. */
export function activeRankingTab(pathname: string) {
  return [...RANKING_TABS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`))?.href;
}

function tabsFor(basePath: string) {
  return basePath === "/pokedex/ranking" ? RANKING_TABS : RANKING_TABS.map((tab) => ({ ...tab, href: `${basePath}${tab.href.slice("/pokedex/ranking".length)}` }));
}

function useCurrent(basePath: string) {
  return activeRankingTab(usePathname().replace(basePath, "/pokedex/ranking"));
}

export function RankingTopBar({ rank, rating, daysLeft, basePath = "/pokedex/ranking" }: { rank: number | null; rating: number | null; daysLeft: number | null; basePath?: string }) {
  const current = useCurrent(basePath);
  const tabs = tabsFor(basePath);
  return (
    <header className="rk-topbar">
      <div className="rk-inner">
        <div style={{ display: "flex", alignItems: "center", gap: 20, minWidth: 0 }}>
          <span className="rk-brand">도감 랭킹전</span>
          <nav className="rk-tabs" aria-label="랭킹전 페이지">
            {tabs.map((tab) => (
              <Link key={tab.href} href={tab.href} className="rk-tab" aria-current={current === tab.href.replace(basePath, "/pokedex/ranking") ? "page" : undefined}>
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {daysLeft !== null && <span className="rk-mutedark">이번 시즌 · D-{daysLeft}</span>}
          {rating !== null && (
            <span className="rk-scorechip">
              {rank !== null && <span style={{ fontSize: 12, fontWeight: 800, color: "var(--rk-hero-primary)" }}>{rank}위</span>}
              <span className="rk-num" style={{ fontSize: 12, fontWeight: 700, color: "var(--rk-on-hero)" }}>{rating.toLocaleString()}점</span>
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

export function RankingBottomNav({ basePath = "/pokedex/ranking" }: { basePath?: string }) {
  const current = useCurrent(basePath);
  const tabs = tabsFor(basePath);
  return (
    <nav className="rk-bottomnav" aria-label="랭킹전 페이지">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={current === tab.href.replace(basePath, "/pokedex/ranking") ? "page" : undefined}>
          <Glyph name={tab.icon} />
          <span>{tab.short}</span>
        </Link>
      ))}
    </nav>
  );
}
