"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** 폭/레이아웃 오버라이드 (기본 max-w-sm). */
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}

/**
 * 네이티브 <dialog> 기반 모달. .member-modal(globals.css) 이 scale+backdrop-blur 로
 * 대칭 등장/퇴장(allow-discrete)을 처리한다(§7 §12). ESC·백드롭 클릭 닫기는 네이티브 제공.
 * reduced-motion 은 전역 baseline(§14) 이 흡수한다.
 */
export function Modal({ open, onClose, className, ariaLabel, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!mounted || !open) return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-label={ariaLabel}
      onClose={onClose}
      onClick={(e) => {
        if (e.target !== dialogRef.current) return;
        const r = dialogRef.current.getBoundingClientRect();
        const inside =
          e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inside) onClose();
      }}
      className={cn(
        "member-modal fixed top-1/2 left-1/2 m-0 w-full -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-gray-200 bg-white dark:bg-gray-100 p-6 shadow-card",
        // cn은 단순 join이라 두 max-w가 함께 남으면 좁은 쪽이 이긴다. 넘겨받았으면 기본값을 빼둔다.
        !className?.includes("max-w-") && "max-w-sm",
        className,
      )}
    >
      {children}
    </dialog>,
    document.body,
  );
}
