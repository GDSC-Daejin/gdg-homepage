import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
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
            <details
              key={notice.id}
              className="group rounded-xl border border-gray-200 bg-white shadow-card"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="block text-base font-semibold text-gray-900">
                    {notice.title}
                  </span>
                  <span className="mt-1 block text-sm text-gray-500">
                    {notice.published_at ? formatKst(notice.published_at) : ""}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="text-gray-500 transition-transform group-open:rotate-180"
                >
                  ⌄
                </span>
              </summary>
              <p className="whitespace-pre-wrap border-t border-gray-100 px-6 pb-6 pt-4 text-sm text-gray-700">
                {notice.body}
              </p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
