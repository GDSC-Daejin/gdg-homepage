import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { formatKstDate } from "@/lib/format";
import type { Notice } from "@/lib/types";
import { isDemoMode } from "@/lib/demo";
import { DEMO_NOTICES } from "@/lib/demoData";

export const dynamic = "force-dynamic";

export default async function AdminNoticesPage() {
  const demo = await isDemoMode();
  let list: Notice[] = DEMO_NOTICES;

  if (!demo) {
    const supabase = await createClient();
    const { data: notices } = await supabase
      .from("notices")
      .select("*")
      .order("created_at", { ascending: false });
    list = (notices ?? []) as Notice[];
  }

  return (
    <div>
      <PageHeader
        title="공지사항"
        description="회원에게 전하는 소식을 작성하고 발행해요"
        action={
          <Link href="/admin/notices/new">
            <Button type="button" variant="primary" className="gap-1">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
              >
                <path d="M10 4.5v11M4.5 10h11" />
              </svg>
              공지 작성
            </Button>
          </Link>
        }
      />
      {list.length === 0 ? (
        <EmptyState
          title="등록된 공지가 없어요"
          description="첫 공지를 작성해 회원에게 소식을 전해보세요."
          icon={
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <path d="M5 3.5A1.5 1.5 0 0 1 6.5 2h5.086a1.5 1.5 0 0 1 1.06.44l2.415 2.414a1.5 1.5 0 0 1 .439 1.061V16.5A1.5 1.5 0 0 1 14 18H6.5A1.5 1.5 0 0 1 5 16.5v-13Z" />
              <path d="M7.5 10.5h3.5M7.5 13.5h2" />
              <path d="m14.5 11.5-3.4 3.4-1.2.4.4-1.2 3.4-3.4a.85.85 0 0 1 1.2 0l-.4-.4a.85.85 0 0 1 0 1.2Z" />
            </svg>
          }
          action={
            <Link href="/admin/notices/new">
              <Button type="button" variant="primary" size="sm" className="gap-1">
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5"
                >
                  <path d="M10 4.5v11M4.5 10h11" />
                </svg>
                공지 작성
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {list.map((notice) => (
            <Link key={notice.id} href={`/admin/notices/${notice.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone={notice.published ? "success" : "neutral"}>
                        {notice.published ? "발행됨" : "미발행"}
                      </Badge>
                      <h2 className="truncate text-base font-semibold text-gray-900">
                        {notice.title}
                      </h2>
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-500">{notice.body}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <p className="flex items-center gap-1 text-sm text-gray-500">
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.75}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3.5 w-3.5"
                      >
                        <rect x="3.5" y="4.5" width="13" height="12" rx="1.5" />
                        <path d="M3.5 8h13M7 2.5v3M13 2.5v3" />
                      </svg>
                      {notice.published_at
                        ? `발행 ${formatKstDate(notice.published_at)}`
                        : `작성 ${formatKstDate(notice.created_at)}`}
                    </p>
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.75}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 shrink-0 text-gray-400"
                    >
                      <path d="M7.5 4.5 13 10l-5.5 5.5" />
                    </svg>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
