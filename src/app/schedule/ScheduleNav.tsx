"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/wds/Button";

/** 원본 헤더의 내 일정 / 지난 일정 · 새 일정 만들기. 활성 항목만 진하다. */
export function ScheduleNav() {
  const pathname = usePathname();
  const isPast = pathname.startsWith("/schedule/past");
  const isMine = pathname === "/schedule" || (!isPast && !pathname.startsWith("/schedule/new"));

  return (
    <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <Link
        href="/schedule"
        style={{
          font: `${isMine ? 600 : 400} 15px/1 var(--wds-font-sans)`,
          color: isMine ? "var(--wds-label-normal)" : "var(--wds-label-alternative)",
          textDecoration: "none",
        }}
      >
        내 일정
      </Link>
      <Link
        href="/schedule/past"
        style={{
          font: `${isPast ? 600 : 400} 15px/1 var(--wds-font-sans)`,
          color: isPast ? "var(--wds-label-normal)" : "var(--wds-label-alternative)",
          textDecoration: "none",
        }}
      >
        지난 일정
      </Link>
    </nav>
  );
}

export function NewPollButton() {
  const pathname = usePathname();
  // 목록 두 화면에서만 띄운다. 만들기·상세 화면에는 그 화면의 버튼이 따로 있다.
  if (pathname !== "/schedule" && pathname !== "/schedule/past") return null;
  return (
    <Link href="/schedule/new">
      <Button variant="solid" color="primary" size="small" round>
        새 일정 만들기
      </Button>
    </Link>
  );
}
