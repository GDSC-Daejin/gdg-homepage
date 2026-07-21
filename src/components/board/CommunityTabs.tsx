"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/board", label: "자유게시판" },
  { href: "/qna", label: "질문답변" },
  { href: "/meetings", label: "회의록" },
];

export function CommunityTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="커뮤니티" className="flex gap-1 border-b border-gray-200">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);

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
