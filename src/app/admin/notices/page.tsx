import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { formatKst } from "@/lib/format";
import type { Notice } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminNoticesPage() {
  const supabase = await createClient();

  const { data: notices } = await supabase
    .from("notices")
    .select("*")
    .order("created_at", { ascending: false });

  const list = (notices ?? []) as Notice[];

  return (
    <div>
      <PageHeader
        title="공지사항"
        description="공지를 작성하고 발행해요"
        action={
          <Link href="/admin/notices/new">
            <Button type="button" variant="primary">
              공지 작성
            </Button>
          </Link>
        }
      />
      {list.length === 0 ? (
        <EmptyState title="등록된 공지가 없어요" />
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((notice) => (
            <Link key={notice.id} href={`/admin/notices/${notice.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone={notice.published ? "success" : "neutral"}>
                        {notice.published ? "발행됨" : "미발행"}
                      </Badge>
                      <h2 className="text-base font-semibold text-gray-900">
                        {notice.title}
                      </h2>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {notice.published_at
                        ? `발행 ${formatKst(notice.published_at)}`
                        : `작성 ${formatKst(notice.created_at)}`}
                    </p>
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
