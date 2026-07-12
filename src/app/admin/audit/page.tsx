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
  set_position: "포지션 변경",
  set_status: "상태 변경",
  review_application: "지원서 심사",
  note_application: "심사 메모 작성",
  send_result_email: "합불 이메일 발송",
  issue_code: "출석 코드 발급",
  answer_inquiry: "문의 답변",
  grant_points: "포인트 부여",
  award_badge: "뱃지 수여",
  publish_notice: "공지 발행",
  update_recruiting_settings: "모집 설정 변경",
};

const ROLE_LABEL: Record<string, string> = {
  organizer: "오거나이저",
  team_member: "팀 멤버",
  member: "회원",
  applicant: "지원자",
};

const STATUS_LABEL: Record<string, string> = {
  active: "활동",
  dormant: "휴면",
  withdrawn: "탈퇴",
};

const POSITION_LABEL: Record<string, string> = {
  frontend: "프론트엔드",
  backend: "백엔드",
  designer: "디자이너",
};

const REVIEW_STATUS_LABEL: Record<string, string> = {
  waiting: "심사 대기",
  pending: "심사 중",
  accepted: "합격",
  rejected: "불합격",
};

// action → target UUID가 가리키는 엔티티 종류
const TARGET_KIND: Record<string, "user" | "event" | "notice" | "inquiry" | "application"> = {
  set_role: "user",
  set_position: "user",
  set_status: "user",
  grant_points: "user",
  award_badge: "user",
  issue_code: "event",
  publish_notice: "notice",
  answer_inquiry: "inquiry",
  review_application: "application",
};

function formatDetail(
  action: string,
  detail: Record<string, unknown>,
  badgeNames: Map<string, string>,
): string {
  switch (action) {
    case "set_role":
      return `역할: ${ROLE_LABEL[detail.role as string] ?? detail.role}`;
    case "set_status":
      return `상태: ${STATUS_LABEL[detail.status as string] ?? detail.status}`;
    case "set_position":
      return `포지션: ${POSITION_LABEL[detail.position as string] ?? detail.position}`;
    case "review_application":
      return `결과: ${REVIEW_STATUS_LABEL[detail.status as string] ?? detail.status}`;
    case "grant_points": {
      const amount = detail.amount as number;
      const sign = amount > 0 ? `+${amount}` : `${amount}`;
      return detail.reason ? `${sign}점 · ${detail.reason}` : `${sign}점`;
    }
    case "award_badge":
      return `뱃지: ${badgeNames.get(detail.badge as string) ?? detail.badge}`;
    default:
      return "-";
  }
}

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
  const targetLabels = new Map<string, string>(
    demo
      ? [
          ["demo-m3", "박지훈"],
          ["demo-m6", "한소희"],
          ["demo-m7", "오지훈"],
          ["demo-ap3", "최지우"],
          ["demo-ap4", "한서준"],
          ["demo-e3", "React 19 세션"],
          ["demo-iq1", "포인트는 어떻게 적립되나요?"],
          ["demo-iq4", "지난 세션 자료를 다시 받고 싶어요"],
        ]
      : [],
  );
  const badgeNames = new Map<string, string>();

  if (!demo) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("audit_logs")
      .select("id, actor, action, target, detail, created_at, profiles(name)")
      .order("created_at", { ascending: false })
      .limit(100);

    logs = (data as unknown as AuditLogRow[] | null) ?? [];

    // target UUID를 사람이 읽을 이름으로 해석 (엔티티 종류별로 묶어서 배치 조회)
    const ids = { user: new Set<string>(), event: new Set<string>(), notice: new Set<string>(), inquiry: new Set<string>(), application: new Set<string>() };
    const badgeIds = new Set<string>();
    for (const log of logs) {
      const kind = TARGET_KIND[log.action];
      if (kind && log.target) ids[kind].add(log.target);
      if (log.action === "award_badge" && typeof log.detail.badge === "string") badgeIds.add(log.detail.badge);
    }

    // 지원서는 지원자 이름으로 표시 → applicant_id를 유저 조회에 합류
    const appToUser = new Map<string, string>();
    if (ids.application.size > 0) {
      const { data: apps } = await supabase
        .from("applications")
        .select("id, applicant_id")
        .in("id", [...ids.application]);
      for (const a of apps ?? []) {
        appToUser.set(a.id as string, a.applicant_id as string);
        ids.user.add(a.applicant_id as string);
      }
    }

    const fetchNames = async (
      table: string,
      idSet: Set<string>,
      col: string,
    ) => {
      if (idSet.size === 0) return;
      const { data: rows } = await supabase
        .from(table)
        .select(`id, ${col}`)
        .in("id", [...idSet]);
      for (const r of (rows as Record<string, unknown>[] | null) ?? []) {
        targetLabels.set(r.id as string, (r[col] as string) ?? "");
      }
    };

    await Promise.all([
      fetchNames("profiles", ids.user, "name"),
      fetchNames("events", ids.event, "title"),
      fetchNames("notices", ids.notice, "title"),
      fetchNames("inquiries", ids.inquiry, "title"),
    ]);

    // 지원서 target → 지원자 이름
    for (const [appId, userId] of appToUser) {
      const name = targetLabels.get(userId);
      if (name) targetLabels.set(appId, name);
    }

    if (badgeIds.size > 0) {
      const { data: badges } = await supabase
        .from("badges")
        .select("id, name")
        .in("id", [...badgeIds]);
      for (const b of badges ?? []) badgeNames.set(b.id as string, b.name as string);
    }
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
                    {(log.target && targetLabels.get(log.target)) || log.target || "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatDetail(log.action, log.detail, badgeNames)}
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
