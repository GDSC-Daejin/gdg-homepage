"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";

// member/admin 셸 공용. 데스크톱(sm:)은 기존 고정 사이드바, 모바일은 상단바 + 슬라이드 드로어.
export function ResponsiveShell({
  sidebar,
  children,
  asideClassName = "dark:bg-gray-100",
  // 조율 화면은 자기 헤더를 본문 폭 끝까지 붙여야 해서 여백을 없앤다.
  mainClassName = "px-4 py-6 sm:px-8 sm:py-8",
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  asideClassName?: string;
  mainClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 네비게이션하면 드로어 닫기
  useEffect(() => setOpen(false), [pathname]);

  // 드로어 열림 동안 배경 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">
        본문으로 건너뛰기
      </a>
      {/* 모바일 상단바 (§5: 사이드바 대체) */}
      <header className="material sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 px-4 py-3 sm:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="메뉴 열기"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 active:bg-gray-200"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            className="h-5 w-5"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Logo className="h-7 w-7 shrink-0" />
        <p className="text-base font-bold text-gray-900">GDGOC DJU</p>
      </header>

      <div className="flex min-h-screen w-full">
        {/* 백드롭 */}
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/40 sm:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
        )}

        {/* 사이드바: 데스크톱 sticky 컬럼 / 모바일 fixed 드로어 */}
        <aside
          className={`no-scrollbar fixed inset-y-0 left-0 z-50 flex h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white px-4 py-6 transition-transform duration-[var(--duration-base)] ease-[var(--ease-out-quart)] sm:sticky sm:top-0 sm:z-auto sm:translate-x-0 ${
            open ? "translate-x-0" : "-translate-x-full"
          } ${asideClassName}`}
        >
          {/* 모바일 닫기 */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="메뉴 닫기"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 sm:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              className="h-5 w-5"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          {sidebar}
        </aside>

        <main id="main-content" tabIndex={-1} className={`min-w-0 flex-1 ${mainClassName}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
