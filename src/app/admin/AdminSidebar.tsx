import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "@/actions/profile";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/app/(member)/ThemeToggle";
import { AdminSidebarNav } from "./AdminSidebarNav";
import { TourModeToggle } from "./TourModeToggle";
import { isDemoMode } from "@/lib/demo";

const roleLabel: Record<string, string> = {
  organizer: "오거나이저",
  team_member: "팀 멤버",
  member: "멤버",
  applicant: "지원자",
};

/** 어드민과 조율(/schedule) 화면이 함께 쓰는 사이드바 내용. */
export async function AdminSidebar() {
  const profile = await requireAdmin();
  const demo = await isDemoMode();

  return (
    <>
      <Link href="/admin" className="flex items-center gap-2.5 px-3 pb-6">
        <Logo className="h-8 w-8 shrink-0" />
        <div>
          <p className="text-base font-bold text-gray-900">GDG DJU</p>
          <p className="text-xs text-gray-500">동아리 관리 시스템</p>
        </div>
      </Link>
      <AdminSidebarNav />
      <div className="mt-auto flex flex-col gap-3 border-t border-gray-200 pt-6">
        <Link
          href="/"
          className="flex w-full items-center justify-center rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200"
        >
          일반유저 화면으로 돌아가기
        </Link>
        <TourModeToggle active={demo} />
        <ThemeToggle />
        <div className="flex items-center gap-2 rounded-md px-1 py-2">
          <Avatar
            name={profile.name}
            avatarPath={profile.avatar_path}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              {profile.name}
            </p>
            <Badge tone="primary">{roleLabel[profile.role]}</Badge>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="로그아웃"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
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
                <path d="M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
