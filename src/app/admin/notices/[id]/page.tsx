import Link from "next/link";
import { notFound } from "next/navigation";
import { getCommunity } from "@/lib/community";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { formatKst } from "@/lib/format";
import { NoticeForm } from "../NoticeForm";
import { NoticeActions } from "../NoticeActions";

export const dynamic = "force-dynamic";

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className="mt-0.5 h-4 w-4 shrink-0"
    >
      <circle cx="10" cy="10" r="7.25" />
      <path d="M10 9v4M10 6.5h.01" />
    </svg>
  );
}

export default async function AdminNoticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const community = await getCommunity();
  const n = await community.notices.reads.get(id);
  if (!n) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/notices" className="text-xs text-gray-500 hover:text-gray-700">
        공지사항 <span className="mx-1">&gt;</span> 수정
      </Link>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Badge tone={n.published ? "success" : "neutral"}>
            {n.published ? "발행됨" : "미발행"}
          </Badge>
          <h1 className="text-xl font-bold text-gray-900">공지 수정</h1>
        </div>
        <NoticeActions noticeId={n.id} published={n.published} title={n.title} />
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-500">
          {n.published && n.published_at
            ? `발행 ${formatKst(n.published_at)} · 회원에게 노출 중`
            : "아직 발행 전이에요. 발행하면 회원에게 노출되고 슬랙으로도 전달돼요."}
        </p>
        {n.published ? (
          <div className="flex items-start gap-2 rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-600">
            <InfoIcon />
            <p>
              이미 발행된 공지예요. 재발행은 할 수 없고, 내용을 수정하면 회원에게 보이는 공지에
              바로 반영돼요. (슬랙 재전송은 되지 않아요)
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary">
            <InfoIcon />
            <p>
              발행은 한 번만 가능한 작업이에요. 발행 버튼을 누르면 즉시 슬랙으로 공지가 전달되며
              되돌릴 수 없어요.
            </p>
          </div>
        )}
      </div>
      <Card>
        <NoticeForm notice={n} />
      </Card>
    </div>
  );
}
