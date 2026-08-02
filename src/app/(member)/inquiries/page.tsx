import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { formatKst } from "@/lib/format";
import type { Inquiry, InquiryStatus } from "@/lib/types";
import { INQUIRY_CATEGORY_LABEL, INQUIRY_CATEGORY_TONE } from "@/lib/types";
import { InquiryForm } from "./InquiryForm";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<InquiryStatus, string> = {
  pending: "접수",
  answered: "답변완료",
};

const STATUS_TONE: Record<InquiryStatus, "warning" | "success"> = {
  pending: "warning",
  answered: "success",
};

export default async function InquiriesPage() {
  const profile = await requireProfile();

  const supabase = await createClient();
  const { data } = await supabase
    .from("inquiries")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });
  const inquiries = (data as Inquiry[] | null) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="문의/건의" description="궁금한 점이나 건의사항을 남겨주세요" />

      <Card>
        <InquiryForm />
      </Card>

      {inquiries.length === 0 ? (
        <EmptyState title="문의 내역이 없어요" description="위 폼으로 문의를 남겨보세요" />
      ) : (
        <div className="flex flex-col gap-4">
          {inquiries.map((inquiry) => (
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
                    {formatKst(inquiry.created_at)}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[inquiry.status]}>
                  {STATUS_LABEL[inquiry.status]}
                </Badge>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
                {inquiry.body}
              </p>
              {inquiry.status === "answered" && (
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
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
