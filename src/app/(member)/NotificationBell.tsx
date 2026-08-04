"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { markAllRead, markNotificationsRead } from "@/actions/notification";
import { formatRelativeKst } from "@/lib/format";
import { useDismiss } from "@/lib/useDismiss";
import type { Notification } from "@/lib/types";

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
}

export function notificationMenuPosition(
  trigger: Pick<DOMRect, "top" | "bottom" | "right">,
  viewport: { width: number; height: number },
): CSSProperties {
  const inset = 16;
  const gap = 8;
  const width = Math.min(320, viewport.width - inset * 2);
  const spaceAbove = trigger.top - inset - gap;
  const spaceBelow = viewport.height - trigger.bottom - inset - gap;
  const left = Math.max(inset, Math.min(trigger.right - width, viewport.width - width - inset));

  return spaceAbove >= spaceBelow
    ? { position: "fixed", left, bottom: viewport.height - trigger.top + gap, width, maxHeight: spaceAbove }
    : { position: "fixed", left, top: trigger.bottom + gap, width, maxHeight: spaceBelow };
}

export function NotificationBell({ notifications, unreadCount }: NotificationBellProps) {
  const router = useRouter();
  const { ref, open, setOpen } = useDismiss<HTMLDivElement>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>();
  const [items, setItems] = useState(notifications);
  const [unread, setUnread] = useState(unreadCount);

  useEffect(() => {
    setItems(notifications);
    setUnread(unreadCount);
  }, [notifications, unreadCount]);

  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, setOpen]);

  function toggleMenu() {
    if (open) {
      setOpen(false);
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger) return;
    setMenuStyle(
      notificationMenuPosition(trigger.getBoundingClientRect(), {
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    );
    setOpen(true);
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (!items.length || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  }

  async function handleRead(notification: Notification) {
    const wasUnread = !notification.read_at;
    if (wasUnread) {
      const readAt = new Date().toISOString();
      setItems((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, read_at: readAt } : item)),
      );
      setUnread((current) => Math.max(0, current - 1));
      await markNotificationsRead([notification.id]);
      router.refresh();
    }

    if (notification.link) router.push(notification.link);
    setOpen(false);
  }

  async function handleMarkAll() {
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? readAt })));
    setUnread(0);
    await markAllRead();
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={unread > 0 ? `알림 ${unread}건 안 읽음` : "알림"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggleMenu}
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span role="status" aria-live="polite" aria-label={`${unread}건 안 읽음`} className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && menuStyle && createPortal(
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={handleMenuKeyDown}
          onMouseDown={(event) => event.stopPropagation()}
          style={menuStyle}
          className="select-menu z-50 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-card dark:bg-gray-100"
        >
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-sm font-semibold text-gray-900">알림</p>
            {unread > 0 && (
              <button
                type="button"
                role="menuitem"
                onClick={handleMarkAll}
                className="text-xs font-medium text-primary hover:underline"
              >
                모두 읽음
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-gray-400">받은 알림이 없어요</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {items.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleRead(notification)}
                  className="flex w-full gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-gray-100"
                >
                  <span
                    aria-hidden
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      notification.read_at ? "bg-transparent" : "bg-primary"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-900">
                      {notification.title}
                    </span>
                    {notification.body && (
                      <span className="line-clamp-2 mt-0.5 block text-sm text-gray-500">
                        {notification.body}
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-gray-400">
                      {formatRelativeKst(notification.created_at)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
