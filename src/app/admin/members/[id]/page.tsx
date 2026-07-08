import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import type { Profile } from "@/lib/types";
import { MemberRoleStatusForm } from "./MemberRoleStatusForm";

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

  const supabase = await createClient();
  const { data: memberData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (!memberData) notFound();
  const member = memberData as Profile;

  const { data: attendanceData } = await supabase
    .from("attendances")
    .select("id, checked_at, events(id, title, starts_at)")
    .eq("user_id", id)
    .order("checked_at", { ascending: false });

  const attendances = (attendanceData as unknown as AttendanceRow[]) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={member.name || "(이름 없음)"}
        description={`학번 ${member.student_no || "-"}`}
      />

      <Card className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">전공</p>
            <p className="font-medium text-gray-900">{member.major || "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">전화번호</p>
            <p className="font-medium text-gray-900">{member.phone || "-"}</p>
          </div>
          <div>
            <p className="text-gray-500">관심 분야</p>
            <p className="font-medium text-gray-900">
              {member.interests.length > 0 ? member.interests.join(", ") : "-"}
            </p>
          </div>
          <div>
            <p className="text-gray-500">가입일</p>
            <p className="font-medium text-gray-900">
              {new Date(member.joined_at).toLocaleDateString("ko-KR")}
            </p>
          </div>
        </div>
        <MemberRoleStatusForm
          userId={member.id}
          role={member.role}
          status={member.status}
        />
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-gray-900">
          출석 기록
        </h2>
        {attendances.length === 0 ? (
          <EmptyState title="출석 기록이 없어요" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2 font-medium">이벤트</th>
                <th className="py-2 font-medium">일시</th>
                <th className="py-2 font-medium">출석 시각</th>
              </tr>
            </thead>
            <tbody>
              {attendances.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="py-2 text-gray-900">
                    {row.events?.title ?? "-"}
                  </td>
                  <td className="py-2 text-gray-500">
                    {row.events
                      ? new Date(row.events.starts_at).toLocaleString(
                          "ko-KR",
                        )
                      : "-"}
                  </td>
                  <td className="py-2 text-gray-500">
                    {new Date(row.checked_at).toLocaleString("ko-KR")}
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
