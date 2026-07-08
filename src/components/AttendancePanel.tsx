import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { IssueCodeButton } from "@/components/IssueCodeButton";
import type { RegistrationStatus } from "@/lib/types";

interface RegistrationRow {
  id: string;
  user_id: string;
  status: RegistrationStatus;
  profiles: { name: string; student_no: string } | null;
}

const STATUS_LABEL: Record<RegistrationStatus, string> = {
  confirmed: "확정",
  waitlisted: "대기",
};

const STATUS_TONE: Record<RegistrationStatus, "success" | "neutral"> = {
  confirmed: "success",
  waitlisted: "neutral",
};

interface AttendancePanelProps {
  eventId: string;
}

export async function AttendancePanel({ eventId }: AttendancePanelProps) {
  const supabase = await createClient();

  const [{ data: registrationsData }, { data: attendancesData }, { data: codeData }] =
    await Promise.all([
      supabase
        .from("event_registrations")
        .select("id, user_id, status, profiles(name, student_no)")
        .eq("event_id", eventId)
        .order("status", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase.from("attendances").select("user_id").eq("event_id", eventId),
      supabase
        .from("event_codes")
        .select("code")
        .eq("event_id", eventId)
        .maybeSingle(),
    ]);

  const registrations = (registrationsData as unknown as RegistrationRow[]) ?? [];
  const attendedUserIds = new Set(
    (attendancesData ?? []).map((a) => a.user_id),
  );
  const confirmedCount = registrations.filter(
    (r) => r.status === "confirmed",
  ).length;
  const attendedCount = registrations.filter(
    (r) => r.status === "confirmed" && attendedUserIds.has(r.user_id),
  ).length;
  const code = codeData?.code ?? null;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const attendUrl = code
    ? `${siteUrl}/attend?event=${eventId}&code=${code}`
    : null;
  const qrDataUrl = attendUrl ? await QRCode.toDataURL(attendUrl) : null;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">출석 현황</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {attendedCount} / {confirmedCount}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">현재 코드</span>
              <span className="font-mono text-lg font-bold text-gray-900">
                {code ?? "미발급"}
              </span>
            </div>
            <IssueCodeButton eventId={eventId} hasCode={code !== null} />
          </div>
        </div>
        {qrDataUrl && attendUrl && (
          <div className="mt-4 flex flex-col items-center gap-2 border-t border-gray-100 pt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="출석 QR 코드" className="h-40 w-40" />
            <p className="font-mono text-xs text-gray-400">{attendUrl}</p>
          </div>
        )}
      </Card>

      <Card className="overflow-x-auto p-0">
        <div className="border-b border-gray-200 px-4 py-3">
          <p className="text-sm font-semibold text-gray-900">신청자 목록</p>
        </div>
        {registrations.length === 0 ? (
          <div className="p-6">
            <EmptyState title="신청자가 없어요" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 font-medium">학번</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">출석</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {row.profiles?.name || "(이름 없음)"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.profiles?.student_no || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[row.status]}>
                      {STATUS_LABEL[row.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {attendedUserIds.has(row.user_id) ? (
                      <Badge tone="success">출석</Badge>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
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
