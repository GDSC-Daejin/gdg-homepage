import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import type { Profile } from "@/lib/types";
import { MemberFilters } from "./MemberFilters";
import { MemberRow } from "./MemberRow";
import { ApproveButton } from "./ApproveButton";
import { formatKstDate } from "@/lib/format";
import { isDemoMode } from "@/lib/demo";
import { DEMO_MEMBERS } from "@/lib/demoData";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string; academicStatus?: string; pending?: string }>;
}) {
  await requireAdmin();
  const { q, role, status, academicStatus, pending } = await searchParams;
  const demo = await isDemoMode();

  const isPending = Boolean(pending);

  let members: Profile[] = DEMO_MEMBERS;
  let totalMembers = DEMO_MEMBERS.length;
  let pendingCount = DEMO_MEMBERS.filter((m) => !m.approved_at).length;

  if (demo && isPending) members = DEMO_MEMBERS.filter((m) => !m.approved_at);

  if (!demo) {
    const supabase = await createClient();
    let query = supabase
      .from("profiles")
      .select("*")
      // 승인 대기는 오래 기다린 순으로 본다.
      .order("joined_at", { ascending: !isPending });

    if (q) {
      const term = q.replace(/[%,]/g, "");
      query = query.or(
        `name.ilike.%${term}%,nickname.ilike.%${term}%,student_no.ilike.%${term}%`,
      );
    }
    if (role) query = query.eq("role", role);
    if (status) query = query.eq("status", status);
    if (academicStatus) query = query.eq("academic_status", academicStatus);
    if (isPending) query = query.is("approved_at", null);

    const [{ data }, { count }, { count: pendingTotal }] = await Promise.all([
      query,
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .is("approved_at", null),
    ]);
    members = (data as Profile[]) ?? [];
    totalMembers = count ?? 0;
    pendingCount = pendingTotal ?? 0;
  }

  const hasFilter = Boolean(q || role || status || academicStatus);
  const organizerExists = members.some((m) => m.role === "organizer");

  return (
    <div>
      <PageHeader
        title="회원 관리"
        description={
          isPending
            ? "가입 신청한 회원을 확인하고 승인해요. 승인해야 회원 기능이 열려요"
            : "전체 회원을 검색·필터링하고, 역할·상태를 바로 수정해요"
        }
        action={
          <p className="text-sm text-gray-500">
            {isPending ? `${members.length}명 대기` : `총 ${totalMembers}명`}
          </p>
        }
      />

      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {[
          { href: "/admin/members", label: "전체", active: !isPending },
          {
            href: "/admin/members?pending=1",
            label: `승인 대기${pendingCount ? ` ${pendingCount}` : ""}`,
            active: isPending,
          },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab.active
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {!isPending && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-card sm:p-6">
          <MemberFilters q={q} role={role} status={status} academicStatus={academicStatus} />
        </div>
      )}

      {members.length === 0 ? (
        <EmptyState
          title={isPending ? "승인 대기 중인 회원이 없어요" : "회원이 없어요"}
          description={
            isPending
              ? "새 가입 신청이 들어오면 여기에 표시돼요"
              : q
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
      ) : isPending ? (
        <section className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">이름</th>
                  <th className="px-4 py-3 font-medium">학번</th>
                  <th className="px-4 py-3 font-medium">전공</th>
                  <th className="px-4 py-3 font-medium">전화번호</th>
                  <th className="px-4 py-3 font-medium">신청일</th>
                  <th className="px-4 py-3 text-right font-medium">승인</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/members/${member.id}`}
                        className="font-medium text-gray-900 hover:text-primary"
                      >
                        {member.name || "이름 없음"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{member.student_no || "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{member.major || "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{member.phone || "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{formatKstDate(member.joined_at)}</td>
                    <td className="px-4 py-3">
                      <ApproveButton userId={member.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-6">
            <h2 className="text-sm font-semibold text-gray-900">회원 목록</h2>
            <p className="text-sm text-gray-500">{members.length}명</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">이름</th>
                  <th className="px-4 py-3 font-medium">닉네임</th>
                  <th className="px-4 py-3 font-medium">학번</th>
                  <th className="px-4 py-3 font-medium">전공</th>
                  <th className="px-4 py-3 font-medium">전화번호</th>
                  <th className="px-4 py-3 font-medium">역할</th>
                  <th className="px-4 py-3 font-medium">포지션</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">재학여부</th>
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
          </div>
        </section>
      )}
    </div>
  );
}
