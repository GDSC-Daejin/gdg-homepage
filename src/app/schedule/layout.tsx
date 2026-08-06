// WDS 토큰. globals.css의 @import는 Tailwind 파이프라인을 통과하지 못해 여기서 직접 싣는다.
import "../wds.css";
import { cookies } from "next/headers";
import { requireProfile } from "@/lib/auth";
import { ResponsiveShell } from "@/components/ResponsiveShell";
import { AdminSidebar } from "@/app/admin/AdminSidebar";
import { SectionTabs, EVENT_TABS } from "@/app/admin/SectionTabs";
import { MemberShell } from "@/app/(member)/MemberShell";
import { isStaff } from "@/lib/types";
import { ScheduleLayoutBar } from "./ScheduleNav";
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
  const memberShell = scheduleShell === "member" || !isStaff(profile);
  const content = (
    <div
      className="wds-surface"
      style={{
        minHeight: "100%",
        borderRadius: memberShell ? 20 : 0,
        background: "var(--wds-bg-alt)",
        boxShadow: memberShell ? "var(--shadow-material)" : undefined,
        fontFamily: "var(--wds-font-sans)",
        color: "var(--wds-label-normal)",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <div>
        <ScheduleLayoutBar
          className={styles.layoutBar}
          canCreate={isStaff(profile)}
          showNav={memberShell}
        />
        {children}
      </div>
    </div>
  );

  if (memberShell) {
    return <MemberShell profile={profile} contentClassName="max-w-[1536px]">{content}</MemberShell>;
  }
  return (
    <ResponsiveShell asideClassName="dark:bg-gray-50" sidebar={<AdminSidebar />}>
      <div className="mx-auto w-full max-w-[96rem] overflow-hidden rounded-[20px] bg-gray-50 shadow-material">
        {/* 사이드바 `이벤트` 한 칸이 이벤트·조율을 함께 품는다 — 여기가 그 탭 줄이다. */}
        <div className="px-6 pt-6 sm:px-8">
          <SectionTabs tabs={EVENT_TABS} label="이벤트" />
        </div>
        {content}
      </div>
    </ResponsiveShell>
  );
}
