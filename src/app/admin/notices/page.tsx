import Link from "next/link";
import { getCommunity } from "@/lib/community";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { formatKstDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminNoticesPage() {
  const community = await getCommunity();
  const list = await community.notices.reads.list();

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((notice) => (
            <Link key={notice.id} href={`/admin/notices/${notice.id}`} className="block">
              <Card className="flex h-full flex-col gap-3 p-5 transition-colors hover:border-gray-300 hover:bg-gray-50">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={notice.published ? "success" : "neutral"}>
                    {notice.published ? "발행됨" : "미발행"}
                  </Badge>
                  <span className="shrink-0 text-xs text-gray-400">
                    {notice.published_at
                      ? `발행 ${formatKstDate(notice.published_at)}`
                      : `작성 ${formatKstDate(notice.created_at)}`}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-gray-900">
                    {notice.title}
                  </h2>
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-0.5 h-4 w-4 shrink-0 text-gray-300"
                  >
                    <path d="M7.5 4.5 13 10l-5.5 5.5" />
                  </svg>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
