import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import type { Notice } from "@/lib/types";
import { NoticeForm } from "../NoticeForm";
import { DeleteNoticeButton } from "../DeleteNoticeButton";
import { PublishNoticeButton } from "../PublishNoticeButton";
import { isDemoMode } from "@/lib/demo";
import { DEMO_NOTICES } from "@/lib/demoData";

export const dynamic = "force-dynamic";

export default async function AdminNoticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const demo = await isDemoMode();

  let n: Notice | undefined;

  if (demo) {
    n = DEMO_NOTICES.find((notice) => notice.id === id) ?? DEMO_NOTICES[0];
  } else {
    const supabase = await createClient();
    const { data: notice } = await supabase
      .from("notices")
      .select("*")
      .eq("id", id)
      .single();

    if (!notice) notFound();
    n = notice as Notice;
  }

  if (!n) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="공지 수정"
        action={
          <div className="flex items-center gap-2">
            <PublishNoticeButton noticeId={n.id} published={n.published} />
            <DeleteNoticeButton noticeId={n.id} />
          </div>
        }
      />
      <Card>
        <NoticeForm notice={n} />
      </Card>
    </div>
  );
}
