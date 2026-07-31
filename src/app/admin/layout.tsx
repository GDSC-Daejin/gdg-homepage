import { requireAdmin } from "@/lib/auth";
import { ResponsiveShell } from "@/components/ResponsiveShell";
import { AdminSidebar } from "./AdminSidebar";
import { isDemoMode } from "@/lib/demo";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 사이드바도 같은 검사를 하지만, 접근 차단은 레이아웃이 직접 책임진다(getProfile은 캐시됨).
  await requireAdmin();
  const demo = await isDemoMode();

  return (
    <ResponsiveShell asideClassName="dark:bg-gray-50" sidebar={<AdminSidebar />}>
      {/* 회원 테이블이 11칸이라 1152px(6xl)에선 이름·가입일이 두 줄로 접힌다 */}
      <div className="mx-auto max-w-[96rem]">
        {demo && (
          <div className="mb-6 rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
            둘러보기 모드 · 모든 데이터는 예시입니다
          </div>
        )}
        {children}
      </div>
    </ResponsiveShell>
  );
}
