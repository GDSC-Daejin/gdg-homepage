import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { formatKst } from "@/lib/format";
import type { Notice } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MemberNoticesPage() {
  await requireProfile();

  const supabase = await createClient();
  const { data: notices } = await supabase
    .from("notices")
    .select("*")
    .eq("published", true)
    .order("published_at", { ascending: false });

  const list = (notices ?? []) as Notice[];

  return (
    <div>
      <PageHeader title="공지사항" description="동아리 소식을 확인해요" />
      {list.length === 0 ? (
        <EmptyState title="등록된 공지가 없어요" />
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((notice) => (
            <Link key={notice.id} href={`/notices/${notice.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <h2 className="text-base font-semibold text-gray-900">
                  {notice.title}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {notice.published_at ? formatKst(notice.published_at) : ""}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
