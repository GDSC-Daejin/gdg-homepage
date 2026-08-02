"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type SVGProps } from "react";

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
  attend: "M8 3v3M16 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3 8 2.5 2.5L15.5 12",
  interview: "M8 3v3M16 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3.5 9h5M9.5 15h3",
  notices: "M4 11v2a1 1 0 0 0 1 1h2l7 4V6l-7 4H5a1 1 0 0 0-1 1Zm14-3a4 4 0 0 1 0 6",
  surveys: "M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 6h6M9 12h6M9 15h4",
  inquiries: "M21 12a8 8 0 1 1-3.3-6.5M21 4v5h-5",
  points: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v2m0 6v2m-3-6a3 3 0 0 1 3-1.5c1.66 0 3 .9 3 2s-1.34 2-3 2-3 .9-3 2 1.34 2 3 2a3 3 0 0 0 3-1.5",
  budget: "M3 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Zm14 6h.01",
  materials: "M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z",
  places: "M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  meetingPoll: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm3 4h3v3H8V8Zm5 3h3v3h-3v-3Zm-5 4h3v3H8v-3Z",
  bots: "M12 3v3M7 9h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Zm2.5 4v2m5-2v2M3 13h2m14 0h2",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.06-.4.1-.8.1-1.2Z",
};

interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof icons;
}

interface NavGroup {
  title: string;
  items: NavItem[];
  defaultCollapsed?: boolean;
  fixed?: boolean;
}

const groups: NavGroup[] = [
  {
    title: "운영",
    fixed: true,
    items: [
      { href: "/admin", label: "대시보드", icon: "dashboard" },
      { href: "/admin/members", label: "회원", icon: "members" },
      { href: "/admin/groups", label: "스터디·프로젝트", icon: "groups" },
      { href: "/admin/events", label: "이벤트", icon: "events" },
      { href: "/schedule", label: "스케줄", icon: "meetingPoll" },
      { href: "/admin/places", label: "장소", icon: "places" },
      { href: "/admin/attendance", label: "출석", icon: "attend" },
    ],
  },
  {
    title: "콘텐츠",
    defaultCollapsed: true,
    items: [
      { href: "/admin/notices", label: "공지", icon: "notices" },
      { href: "/admin/surveys", label: "설문", icon: "surveys" },
      { href: "/admin/inquiries", label: "문의", icon: "inquiries" },
      { href: "/admin/materials", label: "자료실", icon: "materials" },
      { href: "/admin/pokedex?tab=development", label: "포켓몬 개발", icon: "bots" },
    ],
  },
  {
    title: "관리",
    defaultCollapsed: true,
    items: [
      { href: "/admin/points", label: "포인트", icon: "points" },
      { href: "/admin/budget", label: "예산", icon: "budget" },
      { href: "/admin/bots", label: "봇", icon: "bots" },
    ],
  },
  {
    title: "모집",
    defaultCollapsed: true,
    items: [
      { href: "/admin/applications", label: "지원서", icon: "applications" },
      { href: "/admin/interviews", label: "면접 일정", icon: "interview" },
      { href: "/admin/interview-questions", label: "면접 질문", icon: "interview" },
      { href: "/admin/settings", label: "설정", icon: "settings" },
    ],
  },
];

const allHrefs = groups.flatMap((g) => g.items.map((i) => i.href));

function itemActive(href: string, pathname: string) {
  // 대시보드 항목은 하위 탭(분석)까지 포함해 active로 본다.
  if (href === "/admin") {
    return pathname === "/admin" || pathname.startsWith("/admin/analytics");
  }
  if (!pathname.startsWith(href)) return false;
  // 경로가 겹치는 항목끼리는 더 긴 쪽만 active.
  return !allHrefs.some((other) => other.length > href.length && pathname.startsWith(other));
}

export function AdminSidebarNav() {
  const pathname = usePathname();
  // 접힘 상태: defaultCollapsed 그룹은 접되, 현재 경로를 포함하면 펼쳐 둔다.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const g of groups) {
      if (g.defaultCollapsed && !g.items.some((i) => itemActive(i.href, pathname))) {
        s.add(g.title);
      }
    }
    return s;
  });

  const toggle = (title: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(title) ? next.delete(title) : next.add(title);
      return next;
    });

  return (
    <nav className="flex flex-col gap-5">
      {groups.map((group) => {
        const isCollapsed = !group.fixed && collapsed.has(group.title);
        return (
          <div key={group.title} className="flex flex-col gap-1">
            {group.fixed ? (
              <p className="px-3 py-1 text-xs font-semibold text-gray-400">
                {group.title}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => toggle(group.title)}
                aria-expanded={!isCollapsed}
                className="flex items-center justify-between px-3 py-1 text-xs font-semibold text-gray-400 hover:text-gray-600"
              >
                {group.title}
                <Icon
                  d="M6 9l6 6 6-6"
                  className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${
                    isCollapsed ? "-rotate-90" : ""
                  }`}
                />
              </button>
            )}
            {!isCollapsed &&
              group.items.map((item) => {
                const active = itemActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
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
