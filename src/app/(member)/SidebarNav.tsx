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
  home: "M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9",
  events: "M8 3v3M16 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
  attend: "M8 3v3M16 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3 8 2.5 2.5L15.5 12",
  notices: "M4 11v2a1 1 0 0 0 1 1h2l7 4V6l-7 4H5a1 1 0 0 0-1 1Zm14-3a4 4 0 0 1 0 6",
  meetings: "M7 3h10a1 1 0 0 1 1 1v13l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1Z",
  board: "M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  qna: "M12 17.5h.01M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  materials: "M4 7a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z",
  surveys: "M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 6h6M9 12h6M9 15h4",
  inquiries: "M21 12a8 8 0 1 1-3.3-6.5M21 4v5h-5",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  admin: "m12 3 7 3v5c0 4.5-3 7.5-7 10-4-2.5-7-5.5-7-10V6Z",
};

interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof icons;
  matchPrefixes?: string[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const baseGroups: NavGroup[] = [
  { title: "메인", items: [{ href: "/", label: "홈", icon: "home" }] },
  {
    title: "활동",
    items: [
      { href: "/events", label: "이벤트", icon: "events" },
      { href: "/notices", label: "공지", icon: "notices" },
      { href: "/board", label: "커뮤니티", icon: "board", matchPrefixes: ["/board", "/qna", "/meetings"] },
      { href: "/surveys", label: "설문", icon: "surveys" },
      { href: "/inquiries", label: "문의", icon: "inquiries" },
    ],
  },
  {
    title: "자료",
    items: [{ href: "/materials", label: "자료실", icon: "materials" }],
  },
  {
    title: "계정",
    items: [{ href: "/profile", label: "프로필", icon: "profile" }],
  },
];

export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const groups: NavGroup[] = isAdmin
    ? [
        ...baseGroups,
        { title: "관리", items: [{ href: "/admin", label: "어드민", icon: "admin" }] },
      ]
    : baseGroups;

  return (
    <nav className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          <p className="px-3 text-xs font-semibold text-gray-400">
            {group.title}
          </p>
          {group.items.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : item.matchPrefixes?.some((prefix) => pathname.startsWith(prefix)) ?? pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
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
      ))}
    </nav>
  );
}
