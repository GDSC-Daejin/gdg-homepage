import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { formatKst } from "@/lib/format";
import type { EventType } from "@/lib/types";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<EventType, string> = {
  session: "정기세션",
  study: "스터디",
  mogakco: "모각코",
  party: "파티",
};

const TYPE_TONES: Record<EventType, "primary" | "success" | "warning" | "danger"> = {
  session: "primary",
  study: "success",
  mogakco: "warning",
  party: "danger",
};

interface AttendanceHistoryItem {
  checked_at: string;
  event: { id: string; title: string; type: EventType; starts_at: string } | null;
}

export default async function AttendPage() {
  const profile = await requireProfile();

  const supabase = await createClient();
  const { data: attendances } = await supabase
    .from("attendances")
    .select("checked_at, event:events(id, title, type, starts_at)")
    .eq("user_id", profile.id)
    .order("checked_at", { ascending: false })
    .returns<AttendanceHistoryItem[]>();

  const history = (attendances ?? []).filter((a) => a.event);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader
        title="출석 이력"
        description="지금까지 참석한 활동을 확인할 수 있어요"
      />
      {history.length > 0 ? (
        <div className="flex flex-col gap-2">
          {history.map((a) => (
            <Card
              key={a.event!.id}
              className="flex items-center justify-between gap-4 p-4"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Badge tone={TYPE_TONES[a.event!.type]} className="shrink-0">
                  {TYPE_LABELS[a.event!.type]}
                </Badge>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {a.event!.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatKst(a.event!.starts_at)}
                  </p>
                </div>
              </div>
              <Badge tone="primary" className="shrink-0">출석 완료</Badge>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="아직 참석한 활동이 없어요" />
      )}
    </div>
  );
}
