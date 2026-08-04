import { Suspense } from "react";
import Link from "next/link";
import { isStaff, type Notification, type Profile } from "@/lib/types";
import { signOut } from "@/actions/profile";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { Logo } from "@/components/Logo";
import { ResponsiveShell } from "@/components/ResponsiveShell";
import { isDemoMode } from "@/lib/demo";
import { DEMO_NOTIFICATIONS } from "@/lib/demoData";
import { createClient } from "@/lib/supabase/server";
import { NotificationBell } from "./NotificationBell";
import { SidebarNav } from "./SidebarNav";
import { ThemeToggle } from "./ThemeToggle";

const roleLabel: Record<string, string> = {
  organizer: "오거나이저",
  team_member: "팀 멤버",
  member: "멤버",
  applicant: "지원자",
};

export function MemberShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  return (
    <ResponsiveShell
      sidebar={
        <>
          <Link href="/" className="flex items-center gap-2.5 px-3 pb-6">
          <Logo className="h-8 w-8 shrink-0" />
          <div>
            <p className="text-base font-bold text-gray-900">GDGOC DJU</p>
            <p className="text-xs text-gray-500">동아리 관리 시스템</p>
          </div>
        </Link>
        <SidebarNav isAdmin={isStaff(profile)} />
        <div className="mt-auto flex flex-col gap-3 pt-6">
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
            <Suspense fallback={<NotificationBellFallback />}>
              <NotificationBellData profileId={profile.id} />
            </Suspense>
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
        </>
      }
    >
      <div className="mx-auto w-full max-w-[1100px]">{children}</div>
    </ResponsiveShell>
  );
}

// 알림 쿼리를 셸 크리티컬 경로에서 분리 — 셸은 즉시 페인트, 벨은 스트리밍
async function NotificationBellData({ profileId }: { profileId: string }) {
  let notifications: Notification[] = [];
  let unreadCount = 0;

  if (await isDemoMode()) {
    notifications = DEMO_NOTIFICATIONS;
    unreadCount = DEMO_NOTIFICATIONS.filter((notification) => !notification.read_at).length;
  } else {
    const supabase = await createClient();
    const [{ data: rows }, { count }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, type, title, body, link, read_at, created_at")
        .eq("recipient_id", profileId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", profileId)
        .is("read_at", null),
    ]);
    notifications = (rows ?? []) as Notification[];
    unreadCount = count ?? 0;
  }

  return <NotificationBell notifications={notifications} unreadCount={unreadCount} />;
}

// 스트리밍 중 표시할 벨 — 실제 버튼과 동일 크기(h-8 w-8), 배지는 absolute라 시프트 없음
function NotificationBellFallback() {
  return (
    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500">
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
    </div>
  );
}
