"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/wds/Button";

/** 진행 중인 일정과 지난 일정을 같은 스케줄 안에서 전환한다. */
export function ScheduleNav({ variant = "default" }: { variant?: "default" | "header" | "segment" }) {
  const pathname = usePathname();
  const isPast = pathname.startsWith("/schedule/past");
  const isMine = pathname === "/schedule" || (!isPast && !pathname.startsWith("/schedule/new"));
  const isSegment = variant === "segment";

  return (
    <nav
      aria-label={isSegment ? "스케줄 보기" : undefined}
      style={
        isSegment
          ? {
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: 4,
              background: "var(--wds-bg)",
              border: "1px solid var(--wds-line-alternative)",
              borderRadius: 10,
            }
          : { display: "flex", alignItems: "center", gap: 20 }
      }
    >
      <Link
        href="/schedule"
        aria-current={isMine ? "page" : undefined}
        style={{
          font: `${isMine ? 600 : 400} 15px/1 var(--wds-font-sans)`,
          color: isMine ? "var(--wds-primary)" : "var(--wds-label-alternative)",
          textDecoration: "none",
          padding: variant === "header" ? "0 0 14px" : isSegment ? "7px 12px" : undefined,
          borderRadius: isSegment ? 7 : undefined,
          background: isMine && isSegment ? "var(--wds-primary-bg)" : undefined,
          borderBottom: isMine && variant === "header" ? "2px solid var(--wds-primary)" : undefined,
        }}
      >
        {isSegment ? "진행 중" : "내 일정"}
      </Link>
      <Link
        href="/schedule/past"
        aria-current={isPast ? "page" : undefined}
        style={{
          font: `${isPast ? 600 : 400} 15px/1 var(--wds-font-sans)`,
          color: isPast ? "var(--wds-primary)" : "var(--wds-label-alternative)",
          textDecoration: "none",
          padding: variant === "header" ? "0 0 14px" : isSegment ? "7px 12px" : undefined,
          borderRadius: isSegment ? 7 : undefined,
          background: isPast && isSegment ? "var(--wds-primary-bg)" : undefined,
          borderBottom: isPast && variant === "header" ? "2px solid var(--wds-primary)" : undefined,
        }}
      >
        {isSegment ? "지난 스케줄" : "지난 일정"}
      </Link>
    </nav>
  );
}

export function ScheduleLayoutBar({
  canCreate,
  className,
  navVariant,
}: {
  canCreate: boolean;
  className: string;
  navVariant?: "default" | "header" | "segment";
}) {
  const pathname = usePathname();
  if (/^\/schedule\/[^/]+$/.test(pathname)) return null;

  return (
    <div className={className}>
      <ScheduleNav variant={navVariant} />
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
