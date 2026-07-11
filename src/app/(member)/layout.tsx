import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/types";
import { signOut } from "@/actions/profile";
import { Badge } from "@/components/Badge";
import { Logo } from "@/components/Logo";
import { SidebarNav } from "./SidebarNav";
import { ThemeToggle } from "./ThemeToggle";

export const dynamic = "force-dynamic";

const roleLabel: Record<string, string> = {
  organizer: "오거나이저",
  team_member: "팀 멤버",
  member: "멤버",
  applicant: "지원자",
};

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white dark:bg-gray-100 px-4 py-6">
        <div className="flex items-center gap-2.5 px-3 pb-6">
          <Logo className="h-8 w-8 shrink-0" />
          <div>
            <p className="text-base font-bold text-gray-900">GDG DJU</p>
            <p className="text-xs text-gray-500">동아리 관리 시스템</p>
          </div>
        </div>
        <SidebarNav isAdmin={ADMIN_ROLES.includes(profile.role)} />
        <div className="mt-auto flex flex-col gap-3 pt-6">
          <ThemeToggle />
          <div className="flex items-center gap-2 rounded-md px-1 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
              {profile.name.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
                {profile.name}
              </p>
              <Badge tone="primary">{roleLabel[profile.role]}</Badge>
            </div>
            {/* ponytail: 알림 기능 없음, 레퍼런스 레이아웃 맞춤용 자리표시 버튼 */}
            <button
              type="button"
              aria-label="알림"
              disabled
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400"
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
            </button>
            <form action={signOut}>
              <button
                type="submit"
                aria-label="로그아웃"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
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
      </aside>
      <main className="flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
