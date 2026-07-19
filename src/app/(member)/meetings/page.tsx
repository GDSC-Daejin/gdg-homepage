import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_ROLES } from "@/lib/types";
import type { Meeting } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/Badge";

export const dynamic = "force-dynamic";

const MODE_LABEL: Record<Meeting["mode"], string> = {
  online: "온라인",
  offline: "오프라인",
};

export default async function MemberMeetingsPage() {
  const profile = await requireProfile();
  const isStaff = ADMIN_ROLES.includes(profile.role);

  const supabase = await createClient();
  const { data } = await supabase
    .from("meetings")
    .select("*")
    .order("meeting_date", { ascending: false, nullsFirst: false });

  const list = (data ?? []) as Meeting[];

  return (
    <div>
      <PageHeader title="모지숲 회의록" description="주간 운영회의 요약을 확인해요" />
      {list.length === 0 ? (
        <EmptyState title="공개된 회의록이 없어요" />
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((meeting) => (
            <details
              key={meeting.id}
              className="group rounded-xl border border-gray-200 bg-white shadow-card"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="flex items-center gap-2">
                    <span className="text-base font-semibold text-gray-900">
                      {meeting.title}
                    </span>
                    <Badge tone="neutral">{MODE_LABEL[meeting.mode]}</Badge>
                  </span>
                  <span className="mt-1 block text-sm text-gray-500">
                    {meeting.meeting_date ?? ""}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="text-gray-500 transition-transform group-open:rotate-180"
                >
                  ⌄
                </span>
              </summary>
              <div className="border-t border-gray-100 px-6 pb-6 pt-4">
                <p className="whitespace-pre-wrap text-sm text-gray-700">
                  {meeting.summary || "요약이 아직 없어요."}
                </p>
                {isStaff && meeting.notion_url && (
                  <a
                    href={meeting.notion_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    노션 원문 열기 →
                  </a>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
