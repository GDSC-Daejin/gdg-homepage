import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import type { Profile, Role, MemberStatus } from "@/lib/types";
import { formatKstDate } from "@/lib/format";
import { MemberFilters } from "./MemberFilters";

const ROLE_LABEL: Record<Role, string> = {
  admin: "관리자",
  member: "회원",
  applicant: "지원자",
};

const ROLE_TONE: Record<Role, "primary" | "neutral" | "warning"> = {
  admin: "primary",
  member: "neutral",
  applicant: "warning",
};

const STATUS_LABEL: Record<MemberStatus, string> = {
  active: "활동",
  dormant: "휴면",
  withdrawn: "탈퇴",
};

const STATUS_TONE: Record<MemberStatus, "success" | "neutral" | "danger"> = {
  active: "success",
  dormant: "neutral",
  withdrawn: "danger",
};

export const dynamic = "force-dynamic";

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string }>;
}) {
  await requireAdmin();
  const { q, role, status } = await searchParams;

  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("*")
    .order("joined_at", { ascending: false });

  if (q) {
    const term = q.replace(/[%,]/g, "");
    query = query.or(`name.ilike.%${term}%,student_no.ilike.%${term}%`);
  }
  if (role) query = query.eq("role", role);
  if (status) query = query.eq("status", status);

  const { data } = await query;
  const members = (data as Profile[]) ?? [];

  return (
    <div>
      <PageHeader
        title="회원 관리"
        description="가입한 회원의 역할과 상태를 관리해요"
      />

      <Card className="mb-6">
        <MemberFilters q={q} role={role} status={status} />
      </Card>

      {members.length === 0 ? (
        <EmptyState
          title="회원이 없어요"
          description="검색 조건을 확인해보세요"
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 font-medium">학번</th>
                <th className="px-4 py-3 font-medium">전공</th>
                <th className="px-4 py-3 font-medium">역할</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">가입일</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/members/${member.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {member.name || "(이름 없음)"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {member.student_no || "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {member.major || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={ROLE_TONE[member.role]}>
                      {ROLE_LABEL[member.role]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[member.status]}>
                      {STATUS_LABEL[member.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatKstDate(member.joined_at)}
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
