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
    <div className="flex flex-col gap-8">
      <PageHeader title="문의/건의" description="궁금한 점이나 건의사항을 남겨주세요" />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <Card className="p-5 sm:p-7">
          <div className="mb-7 border-b border-gray-100 pb-5">
            <p className="text-xs font-bold tracking-[0.12em] text-primary">WRITE A MESSAGE</p>
            <h2 className="mt-2 text-lg font-bold tracking-tight text-gray-900">무엇을 도와드릴까요?</h2>
            <p className="mt-1 text-sm text-gray-500">문의 내용을 확인한 뒤 운영진이 답변을 남겨요.</p>
          </div>
          <InquiryForm />
        </Card>

        <aside className="rounded-xl border border-gray-200 bg-gray-50 p-5 sm:p-6">
          <h2 className="text-base font-bold text-gray-900">문의 안내</h2>
          <dl className="mt-5 divide-y divide-gray-200">
            <div className="py-4 first:pt-0">
              <dt className="text-sm font-semibold text-gray-800">답변 확인</dt>
              <dd className="mt-1 text-sm leading-6 text-gray-500">등록한 문의와 답변은 아래 내역에서 언제든 확인할 수 있어요.</dd>
            </div>
            <div className="py-4">
              <dt className="text-sm font-semibold text-gray-800">개인정보 보호</dt>
              <dd className="mt-1 text-sm leading-6 text-gray-500">전화번호나 비밀번호 같은 민감한 정보는 작성하지 마세요.</dd>
            </div>
            <div className="pb-0 pt-4">
              <dt className="text-sm font-semibold text-gray-800">더 정확한 답변</dt>
              <dd className="mt-1 text-sm leading-6 text-gray-500">문제가 발생한 화면과 상황을 구체적으로 알려주세요.</dd>
            </div>
          </dl>
        </aside>
      </div>

      <section aria-labelledby="my-inquiries-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.12em] text-primary">MY MESSAGES</p>
            <h2 id="my-inquiries-heading" className="mt-1 text-lg font-bold tracking-tight text-gray-900">내 문의</h2>
          </div>
          {inquiries.length > 0 && <p className="text-sm text-gray-500">{inquiries.length}건</p>}
        </div>

        {inquiries.length === 0 ? (
          <EmptyState
            className="py-20"
            title="아직 문의 내역이 없어요"
            description="첫 문의를 남기면 이곳에서 답변을 확인할 수 있어요"
          />
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
      </section>
    </div>
  );
}
