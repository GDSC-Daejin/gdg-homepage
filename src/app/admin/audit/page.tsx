import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { formatKst } from "@/lib/format";
import { isDemoMode } from "@/lib/demo";
import { DEMO_AUDIT_LOGS } from "@/lib/demoData";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  set_role: "역할 변경",
  set_status: "상태 변경",
  review_application: "지원서 심사",
  issue_code: "출석 코드 발급",
  answer_inquiry: "문의 답변",
  grant_points: "포인트 부여",
  award_badge: "뱃지 수여",
};

interface AuditLogRow {
  id: number;
  actor: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown>;
  created_at: string;
  profiles: { name: string } | null;
}

export default async function AdminAuditPage() {
  await requireAdmin();
  const demo = await isDemoMode();

  let logs: AuditLogRow[] = DEMO_AUDIT_LOGS;

  if (!demo) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("audit_logs")
      .select("id, actor, action, target, detail, created_at, profiles(name)")
      .order("created_at", { ascending: false })
      .limit(100);

    logs = (data as unknown as AuditLogRow[] | null) ?? [];
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="감사 로그" description="관리자 작업 내역 최근 100건" />

      {logs.length === 0 ? (
        <EmptyState title="감사 로그가 없어요" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">시각</th>
                <th className="px-4 py-3 font-medium">행위자</th>
                <th className="px-4 py-3 font-medium">작업</th>
                <th className="px-4 py-3 font-medium">대상</th>
                <th className="px-4 py-3 font-medium">상세</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="px-4 py-3 text-gray-500">
                    {formatKst(log.created_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {log.profiles?.name || "(알 수 없음)"}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {ACTION_LABEL[log.action] ?? log.action}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {log.target ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {JSON.stringify(log.detail)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
