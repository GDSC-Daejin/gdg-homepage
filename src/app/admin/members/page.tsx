import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import type { Profile } from "@/lib/types";
import { MemberFilters } from "./MemberFilters";
import { MemberRow } from "./MemberRow";
import { isDemoMode } from "@/lib/demo";
import { DEMO_MEMBERS } from "@/lib/demoData";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string }>;
}) {
  await requireAdmin();
  const { q, role, status } = await searchParams;
  const demo = await isDemoMode();

  let members: Profile[] = DEMO_MEMBERS;

  if (!demo) {
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
    members = (data as Profile[]) ?? [];
  }

  const hasFilter = Boolean(q || role || status);
  const organizerExists = members.some((m) => m.role === "organizer");

  return (
    <div>
      <PageHeader
        title="회원 관리"
        description="전체 회원을 검색·필터링하고, 역할·상태를 바로 수정해요"
        action={
          <p className="text-sm text-gray-500">총 {members.length}명</p>
        }
      />

      <Card className="mb-6">
        <MemberFilters q={q} role={role} status={status} />
      </Card>

      {members.length === 0 ? (
        <EmptyState
          title="회원이 없어요"
          description={
            q
              ? `검색 조건을 확인해보세요. '${q}'과 일치하는 회원을 찾지 못했어요.`
              : "검색 조건을 확인해보세요"
          }
          action={
            hasFilter ? (
              <Link
                href="/admin/members"
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                필터 초기화
              </Link>
            ) : undefined
          }
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
                <th className="px-4 py-3 font-medium">포지션</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">가입일</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  organizerTaken={organizerExists && member.role !== "organizer"}
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
