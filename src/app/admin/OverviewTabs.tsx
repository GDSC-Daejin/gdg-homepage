"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/analytics", label: "분석" },
  { href: "/admin/pokedex", label: "도감" },
];

export function OverviewTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="현황" className="flex gap-1 border-b border-gray-200">
      {tabs.map((tab) => {
        const active =
          tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
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
