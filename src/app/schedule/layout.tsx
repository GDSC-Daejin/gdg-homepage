// WDS 토큰. globals.css의 @import는 Tailwind 파이프라인을 통과하지 못해 여기서 직접 싣는다.
import "../wds.css";
import { cookies } from "next/headers";
import { requireProfile } from "@/lib/auth";
import { ResponsiveShell } from "@/components/ResponsiveShell";
import { AdminSidebar } from "@/app/admin/AdminSidebar";
import { MemberShell } from "@/app/(member)/MemberShell";
import { isStaff } from "@/lib/types";
import { NewPollButton, ScheduleNav } from "./ScheduleNav";
import styles from "./schedule.module.css";

export const dynamic = "force-dynamic";

// "언제되지"는 초대 링크 화면에만 남은 이름이다.
export const metadata = { title: "스케줄", robots: { index: false, follow: false } };

/**
 * 조율 화면은 초대된 멤버도 열 수 있다. 관리자는 어드민 사이드바를, 멤버는 기본 셸을 쓴다.
 */
export default async function ScheduleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const scheduleShell = (await cookies()).get("schedule-shell")?.value;
  const content = (
    <div
      className="wds-surface"
      style={{
        minHeight: "100%",
        background: "var(--wds-bg-alt)",
        fontFamily: "var(--wds-font-sans)",
        color: "var(--wds-label-normal)",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* 넓은 화면에서 끝까지 늘어나면 카드가 읽기 어렵다 — 본문을 가운데로 모은다. */}
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div className={styles.layoutBar}>
          <ScheduleNav />
          <NewPollButton canCreate={isStaff(profile)} />
        </div>
        {children}
      </div>
    </div>
  );

  if (scheduleShell === "member" || !isStaff(profile)) return <MemberShell profile={profile}>{content}</MemberShell>;
  return <ResponsiveShell asideClassName="dark:bg-gray-50" sidebar={<AdminSidebar />} mainClassName="">{content}</ResponsiveShell>;
}
