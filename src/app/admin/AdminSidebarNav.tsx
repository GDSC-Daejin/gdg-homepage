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
  applications: "M4 7a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z",
  events: "M8 3v3M16 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
  attend: "M8 3v3M16 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3 8 2.5 2.5L15.5 12",
  notices: "M4 11v2a1 1 0 0 0 1 1h2l7 4V6l-7 4H5a1 1 0 0 0-1 1Zm14-3a4 4 0 0 1 0 6",
  surveys: "M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 6h6M9 12h6M9 15h4",
  inquiries: "M21 12a8 8 0 1 1-3.3-6.5M21 4v5h-5",
  points: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v2m0 6v2m-3-6a3 3 0 0 1 3-1.5c1.66 0 3 .9 3 2s-1.34 2-3 2-3 .9-3 2 1.34 2 3 2a3 3 0 0 0 3-1.5",
  budget: "M3 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Zm14 6h.01",
  audit: "M9 3h6l1 3h3a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3ZM9 12h6M9 16h6M9 8h6",
  materials: "M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z",
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
}

const groups: NavGroup[] = [
  { title: "메인", items: [{ href: "/admin", label: "대시보드", icon: "dashboard" }] },
  {
    title: "운영",
    items: [
      { href: "/admin/members", label: "회원", icon: "members" },
      { href: "/admin/applications", label: "지원서", icon: "applications" },
      { href: "/admin/events", label: "이벤트", icon: "events" },
      { href: "/admin/attendance", label: "출석", icon: "attend" },
    ],
  },
  {
    title: "콘텐츠",
    items: [
      { href: "/admin/notices", label: "공지", icon: "notices" },
      { href: "/admin/surveys", label: "설문", icon: "surveys" },
      { href: "/admin/inquiries", label: "문의", icon: "inquiries" },
      { href: "/admin/materials", label: "자료실", icon: "materials" },
    ],
  },
  {
    title: "관리",
    items: [
      { href: "/admin/points", label: "포인트", icon: "points" },
      { href: "/admin/budget", label: "예산", icon: "budget" },
      { href: "/admin/audit", label: "감사 로그", icon: "audit" },
      { href: "/admin/settings", label: "설정", icon: "settings" },
    ],
  },
];

export function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          <p className="px-3 text-xs font-semibold text-gray-400">
            {group.title}
          </p>
          {group.items.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium ${
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Icon d={icons[item.icon]} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
