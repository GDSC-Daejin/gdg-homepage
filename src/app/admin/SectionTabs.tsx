"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SectionTab {
  href: string;
  label: string;
  /** 하위 경로까지 활성으로 볼지. 기본은 정확히 일치할 때만. */
  prefix?: boolean;
}

/**
 * 사이드바 한 칸이 여러 화면을 품을 때 쓰는 탭 줄.
 * 사이드바 항목 수를 줄이는 게 목적이라, 여기서 다시 계층을 만들지 않는다 — 항상 한 줄이다.
 */
export function SectionTabs({ tabs, label }: { tabs: SectionTab[]; label: string }) {
  const pathname = usePathname();
  const activeHref = tabs.reduce<string | null>((best, tab) => {
    const hit = tab.prefix ? pathname.startsWith(tab.href) : pathname === tab.href;
    if (!hit) return best;
    // 경로가 겹치면 더 긴 쪽을 고른다(/schedule 과 /schedule/past).
    return best && best.length >= tab.href.length ? best : tab.href;
  }, null);

  return (
    <nav aria-label={label} className="mb-6 flex gap-1 border-b border-gray-200">
      {tabs.map((tab) => {
        const active = tab.href === activeHref;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            // /schedule은 회원 셸과 공유하는 라우트라, 어드민에서 들어갈 땐 셸을 명시한다.
            onClick={
              tab.href.startsWith("/schedule")
                ? () => {
                    document.cookie =
                      "schedule-shell=admin; Path=/schedule; SameSite=Lax";
                  }
                : undefined
            }
            aria-current={active ? "page" : undefined}
            className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-primary-soft text-primary"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** 이벤트 = 조율(투표)로 정하고 확정되면 이벤트가 되는 한 흐름이다. */
export const EVENT_TABS: SectionTab[] = [
  { href: "/admin/events", label: "이벤트", prefix: true },
  { href: "/schedule", label: "스케줄", prefix: true },
];

/** 셋 다 회원 명단을 깔고 그 위에 다른 숫자를 얹은 화면이다. */
export const MEMBER_TABS: SectionTab[] = [
  { href: "/admin/members", label: "명단", prefix: true },
  { href: "/admin/attendance", label: "출석", prefix: true },
  { href: "/admin/points", label: "포인트·뱃지", prefix: true },
];

/** 가끔 설정하러 들어오는 것들 — 상시 노출할 이유가 없어 한 칸으로 묶었다. */
export const SYSTEM_TABS: SectionTab[] = [
  { href: "/admin/budget", label: "예산", prefix: true },
  { href: "/admin/bots", label: "봇", prefix: true },
  { href: "/admin/dev", label: "개발", prefix: true },
  { href: "/admin/settings", label: "모집 설정", prefix: true },
];
