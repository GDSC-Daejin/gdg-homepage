"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useDismiss } from "@/lib/useDismiss";

/** 케밥(⋯) 트리거 + 팝오버 메뉴. 바깥 클릭·Escape 로 닫힌다. */
export function DropdownMenu({
  label = "더보기",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const { ref, open, setOpen } = useDismiss<HTMLDivElement>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (!items.length || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    items[(current + step + items.length) % items.length].focus();
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <circle cx="4" cy="10" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="16" cy="10" r="1.5" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={handleKeyDown}
          onClick={() => setOpen(false)}
          className="select-menu absolute right-0 top-full z-50 mt-1 w-32 rounded-xl border border-gray-200 bg-white p-1 shadow-card dark:bg-gray-100"
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  tone = "default",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "default" | "danger" }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100",
        tone === "danger" ? "text-danger" : "text-gray-700",
        className,
      )}
      {...props}
    />
  );
}
