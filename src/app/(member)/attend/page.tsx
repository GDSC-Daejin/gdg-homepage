import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { AttendForm } from "./AttendForm";

export const dynamic = "force-dynamic";

interface AttendPageProps {
  searchParams: Promise<{ event?: string; code?: string }>;
}

export default async function AttendPage({ searchParams }: AttendPageProps) {
  await requireProfile();
  const params = await searchParams;

  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, title")
    .gte("starts_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("starts_at", { ascending: true });

  return (
    <div className="mx-auto w-full max-w-md">
      <PageHeader
        title="출석 체크"
        description="이벤트를 선택하고 출석 코드를 입력해주세요"
      />
      {events && events.length > 0 ? (
        <AttendForm
          events={events}
          defaultEventId={params.event}
          defaultCode={params.code}
        />
      ) : (
        <EmptyState title="진행 중/다가오는 이벤트가 없어요" />
      )}
    </div>
  );
}
