"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "홈" },
  { href: "/attend", label: "출석" },
  { href: "/notices", label: "공지" },
  { href: "/materials", label: "자료실" },
  { href: "/surveys", label: "설문" },
  { href: "/inquiries", label: "문의" },
  { href: "/profile", label: "프로필" },
];

export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const items = isAdmin ? [...links, { href: "/admin", label: "어드민" }] : links;

  return (
    <nav className="flex flex-col gap-1 text-sm font-medium text-gray-700">
      {items.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-2 ${
              active
                ? "bg-primary-soft text-primary"
                : "hover:bg-gray-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
