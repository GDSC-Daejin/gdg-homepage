import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="flex min-h-full">
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-white px-4 py-6">
        <nav className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <Link
            href="/admin"
            className="rounded-md px-3 py-2 hover:bg-gray-100"
          >
            대시보드
          </Link>
          <Link
            href="/admin/members"
            className="rounded-md px-3 py-2 hover:bg-gray-100"
          >
            회원
          </Link>
          <Link
            href="/admin/applications"
            className="rounded-md px-3 py-2 hover:bg-gray-100"
          >
            지원서
          </Link>
          <Link
            href="/admin/events"
            className="rounded-md px-3 py-2 hover:bg-gray-100"
          >
            이벤트
          </Link>
          <Link
            href="/admin/attendance"
            className="rounded-md px-3 py-2 hover:bg-gray-100"
          >
            출석
          </Link>
        </nav>
      </aside>
      <main className="flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
