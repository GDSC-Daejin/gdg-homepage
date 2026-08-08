"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SVGProps } from "react";

function Icon({
  d,
  ...props
}: SVGProps<SVGSVGElement> & { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0"
      {...props}
    >
      <path d={d} />
    </svg>
  );
}

const icons: Record<string, string> = {
  dashboard: "M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9",
  members: "M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 8a6 6 0 0 1 12 0M17 8a3 3 0 1 1 0 6M20 20a5.5 5.5 0 0 0-4-5.3",
  groups: "M17 20h5v-2a3 3 0 0 0-4.5-2.6M9 20H4v-2a3 3 0 0 1 4.5-2.6M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 8a3 3 0 0 1 6 0m2 0a3 3 0 0 1 6 0",
  applications: "M4 7a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z",
  events: "M8 3v3M16 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
  // 이벤트와 나란히 놓이므로 달력 도형을 피한다 — 출석은 회원 단위 지표다.
  attend: "M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-7 9a7 7 0 0 1 10.5-6.1M14.5 18l2 2 4-4",
  interview: "M8 3v3M16 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3.5 9h5M9.5 15h3",
  notices: "M4 11v2a1 1 0 0 0 1 1h2l7 4V6l-7 4H5a1 1 0 0 0-1 1Zm14-3a4 4 0 0 1 0 6",
  surveys: "M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 6h6M9 12h6M9 15h4",
  inquiries: "M21 12a8 8 0 1 1-3.3-6.5M21 4v5h-5",
  points: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v2m0 6v2m-3-6a3 3 0 0 1 3-1.5c1.66 0 3 .9 3 2s-1.34 2-3 2-3 .9-3 2 1.34 2 3 2a3 3 0 0 0 3-1.5",
  budget: "M3 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Zm14 6h.01",
  dev: "M9 8l-4 4 4 4m6-8 4 4-4 4M13.5 5l-3 14",
  places: "M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  meetingPoll: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm3 4h3v3H8V8Zm5 3h3v3h-3v-3Zm-5 4h3v3H8v-3Z",
  bots: "M12 3v3M7 9h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Zm2.5 4v2m5-2v2M3 13h2m14 0h2",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.06-.4.1-.8.1-1.2Z",
};

interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof icons;
  /** 한 칸이 탭으로 여러 화면을 품을 때, 함께 active로 볼 경로들. */
  covers?: string[];
}

interface NavGroup {
  id: string;
  /** 비우면 제목 없이 항목만 그린다 — 자주 쓰는 것을 맨 위에 붙여둔다. */
  title?: string;
  items: NavItem[];
  /** 모집 시즌에만 노출되는 그룹. */
  seasonal?: boolean;
}

// 매주 쓰는 화면이 없어서 위치를 외우지 못한다 — 접지 않고 전부 펼쳐 두되 개수를 줄인다.
const groups: NavGroup[] = [
  {
    id: "top",
    items: [
      { href: "/admin", label: "대시보드", icon: "dashboard" },
      // 조율(투표)로 정하고 확정되면 이벤트가 된다 — 한 흐름이라 한 칸이다.
      { href: "/admin/events", label: "이벤트", icon: "events", covers: ["/schedule"] },
      { href: "/admin/surveys", label: "설문", icon: "surveys" },
    ],
  },
  {
    id: "ops",
    title: "운영",
    items: [
      {
        href: "/admin/members",
        label: "회원",
        icon: "members",
        covers: ["/admin/attendance", "/admin/points"],
      },
      { href: "/admin/groups", label: "스터디·프로젝트", icon: "groups" },
      { href: "/admin/notices", label: "공지", icon: "notices" },
      { href: "/admin/inquiries", label: "문의", icon: "inquiries" },
      { href: "/admin/places", label: "장소", icon: "places" },
    ],
  },
  {
    id: "recruiting",
    title: "모집",
    seasonal: true,
    items: [
      { href: "/admin/applications", label: "지원서", icon: "applications" },
      { href: "/admin/interviews", label: "면접 일정", icon: "interview" },
      { href: "/admin/interview-questions", label: "면접 질문", icon: "interview" },
    ],
  },
  {
    id: "system",
    items: [
      // 넷 다 가끔 설정하러 들어오는 것들이라 탭 한 칸으로 묶었다.
      // 모집 설정은 모집을 켜고 끄는 스위치라 시즌 그룹에 두면 자기 잠금이 된다.
      {
        href: "/admin/budget",
        label: "시스템",
        icon: "settings",
        covers: ["/admin/bots", "/admin/dev", "/admin/settings"],
      },
    ],
  },
];

const allHrefs = groups.flatMap((g) =>
  g.items.flatMap((i) => [i.href, ...(i.covers ?? [])]),
);

const bottomItems = [
  ...groups[0].items,
  ...groups[1].items.slice(0, 1),
  { ...groups[3].items[0], label: "예산", icon: "budget" as const },
];

function pathActive(href: string, pathname: string) {
  // 대시보드 항목은 하위 탭(분석)까지 포함해 active로 본다.
  if (href === "/admin") {
    return pathname === "/admin" || pathname.startsWith("/admin/analytics");
  }
  if (!pathname.startsWith(href)) return false;
  // 경로가 겹치는 항목끼리는 더 긴 쪽만 active.
  return !allHrefs.some((other) => other.length > href.length && pathname.startsWith(other));
}

function itemActive(item: NavItem, pathname: string) {
  return [item.href, ...(item.covers ?? [])].some((href) => pathActive(href, pathname));
}

export function AdminSidebarNav({ demo = false, recruitingOpen }: { demo?: boolean; recruitingOpen: boolean }) {
  const browserPathname = usePathname();
  const pathname = browserPathname.replace(/^\/tour(?=\/)/, "");
  // 모집 시즌이 닫혀 있어도 이미 그 화면에 들어와 있다면 그룹을 보여준다(길을 잃지 않게).
  const visible = groups.filter(
    (g) =>
      !g.seasonal ||
      recruitingOpen ||
      g.items.some((i) => itemActive(i, pathname)),
  );

  return (
    <nav className="flex flex-col gap-4">
      {visible.map((group) => {
        return (
          <div key={group.id} className="flex flex-col gap-0.5">
            {group.title && (
              <p className="px-3 py-1 text-xs font-semibold text-gray-400">
                {group.title}
              </p>
            )}
            {group.items.filter((item) => !demo || item.href !== "/admin/interviews").map((item) => {
              const active = itemActive(item, pathname);
              return (
                <Link
                  key={item.href}
                  href={demo ? `/tour${item.href}` : item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-100 ${
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-gray-700 hover:bg-gray-100 active:bg-gray-200"
                  }`}
                >
                  <Icon d={icons[item.icon]} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export function AdminBottomNav({ demo = false }: { demo?: boolean }) {
  const browserPathname = usePathname();
  const pathname = browserPathname.replace(/^\/tour(?=\/)/, "");
  const tour = demo || browserPathname.startsWith("/tour/");

  return (
    <nav
      aria-label="주요 메뉴"
      className="material fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-gray-200 px-1 pt-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden"
      style={{ background: "var(--color-gray-50)" }}
    >
      {bottomItems.map((item) => {
        const active = itemActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={tour ? `/tour${item.href}` : item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium transition-colors ${
              active ? "text-primary" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <Icon d={icons[item.icon]} className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
