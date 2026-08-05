"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/wds/Button";

/** 원본 헤더의 내 일정 / 지난 일정 · 새 일정 만들기. 활성 항목만 진하다. */
export function ScheduleNav({ variant = "default" }: { variant?: "default" | "header" }) {
  const pathname = usePathname();
  const isPast = pathname.startsWith("/schedule/past");
  const isMine = pathname === "/schedule" || (!isPast && !pathname.startsWith("/schedule/new"));

  return (
    <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <Link
        href="/schedule"
        style={{
          font: `${isMine ? 600 : 400} 15px/1 var(--wds-font-sans)`,
          color: isMine && variant === "header" ? "var(--wds-primary)" : isMine ? "var(--wds-label-normal)" : "var(--wds-label-alternative)",
          textDecoration: "none",
          paddingBottom: variant === "header" ? 14 : undefined,
          borderBottom: isMine && variant === "header" ? "2px solid var(--wds-primary)" : undefined,
        }}
      >
        내 일정
      </Link>
      <Link
        href="/schedule/past"
        style={{
          font: `${isPast ? 600 : 400} 15px/1 var(--wds-font-sans)`,
          color: isPast && variant === "header" ? "var(--wds-primary)" : isPast ? "var(--wds-label-normal)" : "var(--wds-label-alternative)",
          textDecoration: "none",
          paddingBottom: variant === "header" ? 14 : undefined,
          borderBottom: isPast && variant === "header" ? "2px solid var(--wds-primary)" : undefined,
        }}
      >
        지난 일정
      </Link>
    </nav>
  );
}

export function ScheduleLayoutBar({
  canCreate,
  className,
}: {
  canCreate: boolean;
  className: string;
}) {
  const pathname = usePathname();
  if (/^\/schedule\/[^/]+$/.test(pathname)) return null;

  return (
    <div className={className}>
      <ScheduleNav />
      <NewPollButton canCreate={canCreate} />
    </div>
  );
}

export function NewPollButton({ canCreate }: { canCreate: boolean }) {
  const pathname = usePathname();
  // 목록 두 화면에서만 띄운다. 만들기·상세 화면에는 그 화면의 버튼이 따로 있다.
  if (!canCreate || (pathname !== "/schedule" && pathname !== "/schedule/past")) return null;
  return (
    <Link href="/schedule/new">
      <Button variant="solid" color="primary" size="small" round>
        새 일정 만들기
      </Button>
    </Link>
  );
}
