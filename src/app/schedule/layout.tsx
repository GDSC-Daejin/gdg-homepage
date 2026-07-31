// WDS 토큰. globals.css의 @import는 Tailwind 파이프라인을 통과하지 못해 여기서 직접 싣는다.
import "../wds.css";
import { requireAdmin } from "@/lib/auth";
import { ResponsiveShell } from "@/components/ResponsiveShell";
import { AdminSidebar } from "@/app/admin/AdminSidebar";
import { NewPollButton, ScheduleNav } from "./ScheduleNav";
import styles from "./schedule.module.css";

export const dynamic = "force-dynamic";

// "언제되지"는 초대 링크 화면에만 남은 이름이다.
export const metadata = { title: "스케줄", robots: { index: false, follow: false } };

/**
 * 조율 화면 껍데기. 내비게이션은 어드민 사이드바가 맡고,
 * 원본 목업의 상단 헤더는 탭 + 만들기 버튼 한 줄로 줄였다(브랜드·프로필은 사이드바와 겹친다).
 */
export default async function ScheduleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <ResponsiveShell asideClassName="dark:bg-gray-50" sidebar={<AdminSidebar />} mainClassName="">
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
            <NewPollButton />
          </div>
          {children}
        </div>
      </div>
    </ResponsiveShell>
  );
}
