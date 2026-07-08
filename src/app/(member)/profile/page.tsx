import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { ProfileForm } from "./ProfileForm";
import type { RegistrationStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

interface RegistrationHistoryItem {
  id: string;
  status: RegistrationStatus;
  event: { id: string; title: string; starts_at: string } | null;
}

export default async function ProfilePage() {
  const profile = await requireProfile();

  const supabase = await createClient();
  const [{ data: registrations }, { data: attendances }] = await Promise.all([
    supabase
      .from("event_registrations")
      .select("id, status, event:events(id, title, starts_at)")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .returns<RegistrationHistoryItem[]>(),
    supabase.from("attendances").select("event_id").eq("user_id", profile.id),
  ]);

  const attendedEventIds = new Set((attendances ?? []).map((a) => a.event_id));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <PageHeader title="내 프로필" description="개인 정보를 수정할 수 있어요" />
        <ProfileForm profile={profile} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">신청/출석 이력</h2>
        {registrations && registrations.length > 0 ? (
          <div className="flex flex-col gap-2">
            {registrations.map((r) => (
              <Card
                key={r.id}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {r.event?.title ?? "삭제된 이벤트"}
                  </p>
                  {r.event && (
                    <p className="text-xs text-gray-500">
                      {new Date(r.event.starts_at).toLocaleString("ko-KR")}
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Badge tone={r.status === "confirmed" ? "success" : "warning"}>
                    {r.status === "confirmed" ? "확정" : "대기"}
                  </Badge>
                  {r.event && attendedEventIds.has(r.event.id) && (
                    <Badge tone="primary">출석완료</Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="신청 내역이 없어요" />
        )}
      </div>
    </div>
  );
}
