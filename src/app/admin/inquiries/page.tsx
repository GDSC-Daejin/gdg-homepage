import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getCommunity } from "@/lib/community";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { formatKst } from "@/lib/format";
import type { InquiryStatus } from "@/lib/types";
import { INQUIRY_CATEGORY_LABEL, INQUIRY_CATEGORY_TONE } from "@/lib/types";
import { AnswerForm } from "./AnswerForm";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<InquiryStatus, string> = {
  pending: "접수",
  answered: "답변완료",
};

const STATUS_TONE: Record<InquiryStatus, "warning" | "success"> = {
  pending: "warning",
  answered: "success",
};

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "pending", label: "접수" },
  { value: "answered", label: "답변완료" },
];

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const status = params.status ?? "all";

  const community = await getCommunity();
  const allInquiries = await community.inquiries.reads.list();
  const inquiries = allInquiries.filter(
    (i) => status === "all" || i.status === status,
  );

  const userIds = Array.from(new Set(inquiries.map((i) => i.user_id)));
  const authors = await community.inquiries.reads.authors(userIds);
  const authorMap = new Map(authors.map((a) => [a.id, a]));

  return (
    <div>
      <PageHeader title="문의/건의" description="회원 문의 관리" />
      <div className="mb-4 flex gap-2">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/inquiries?status=${tab.value}`}
            className={
              status === tab.value
                ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
            }
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {inquiries.length === 0 ? (
        <EmptyState title="문의가 없어요" description="선택한 조건에 해당하는 문의가 없어요" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {inquiries.map((inquiry) => {
            const author = authorMap.get(inquiry.user_id);
            return (
              <Card key={inquiry.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone={INQUIRY_CATEGORY_TONE[inquiry.category]}>
                        {INQUIRY_CATEGORY_LABEL[inquiry.category]}
                      </Badge>
                      <p className="font-semibold text-gray-900">{inquiry.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {author?.name ?? "알 수 없음"} · {formatKst(inquiry.created_at)}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[inquiry.status]}>
                    {STATUS_LABEL[inquiry.status]}
                  </Badge>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
                  {inquiry.body}
                </p>
                {inquiry.status === "answered" ? (
                  <div className="mt-4 rounded-md bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-500">답변</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                      {inquiry.answer}
                    </p>
                    {inquiry.answered_at && (
                      <p className="mt-2 text-xs text-gray-400">
                        {formatKst(inquiry.answered_at)}
                      </p>
                    )}
                  </div>
                ) : (
                  <AnswerForm id={inquiry.id} />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
