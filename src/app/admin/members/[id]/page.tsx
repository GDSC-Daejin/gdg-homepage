import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import type { Profile } from "@/lib/types";
import { formatKst } from "@/lib/format";
import { MemberRoleStatusForm } from "./MemberRoleStatusForm";
import { MemberProfileForm } from "./MemberProfileForm";
import { isDemoMode } from "@/lib/demo";
import { DEMO_MEMBERS, DEMO_MEMBER_ATTENDANCE } from "@/lib/demoData";

interface AttendanceRow {
  id: string;
  checked_at: string;
  events: { id: string; title: string; starts_at: string } | null;
}

export const dynamic = "force-dynamic";

export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const demo = await isDemoMode();

  let member: Profile | undefined;
  let attendances: AttendanceRow[] = [];

  if (demo) {
    member = DEMO_MEMBERS.find((m) => m.id === id) ?? DEMO_MEMBERS[0];
    attendances = DEMO_MEMBER_ATTENDANCE[member.id] ?? [];
  } else {
    const supabase = await createClient();
    const { data: memberData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (!memberData) notFound();
    member = memberData as Profile;

    const { data: attendanceData } = await supabase
      .from("attendances")
      .select("id, checked_at, events(id, title, starts_at)")
      .eq("user_id", id)
      .order("checked_at", { ascending: false });

    attendances = (attendanceData as unknown as AttendanceRow[]) ?? [];
  }

  if (!member) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-semibold text-primary">
          {(member.name || "?").slice(0, 1)}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {member.name || "(이름 없음)"}
          </h1>
          <p className="text-sm text-gray-500">
            {member.student_no || "-"} · {member.major || "-"}
          </p>
        </div>
      </div>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">프로필</p>
          <p className="text-xs text-gray-400">
            가입일 {formatKst(member.joined_at)} (KST)
          </p>
        </div>
        <MemberProfileForm
          userId={member.id}
          name={member.name}
          studentNo={member.student_no}
          major={member.major}
          phone={member.phone}
          interests={member.interests}
        />
        <MemberRoleStatusForm
          userId={member.id}
          role={member.role}
          status={member.status}
        />
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            출석 기록
          </h2>
          <p className="text-xs text-gray-400">
            최근순 · 총 {attendances.length}건
          </p>
        </div>
        {attendances.length === 0 ? (
          <EmptyState title="출석 기록이 없어요" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2 font-medium">이벤트</th>
                <th className="py-2 font-medium">이벤트 일시 (KST)</th>
                <th className="py-2 font-medium">출석 체크 (KST)</th>
              </tr>
            </thead>
            <tbody>
              {attendances.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td
                    className={
                      row.events ? "py-2 text-gray-900" : "py-2 text-gray-400"
                    }
                  >
                    {row.events?.title ?? "(삭제된 이벤트)"}
                  </td>
                  <td className="py-2 text-gray-500">
                    {row.events ? formatKst(row.events.starts_at) : "-"}
                  </td>
                  <td className="py-2 text-gray-500">
                    {formatKst(row.checked_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
