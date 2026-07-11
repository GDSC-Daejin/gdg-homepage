import QRCode from "qrcode";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { DEMO_DASHBOARD_ROWS } from "@/lib/demoData";
import { Card } from "@/components/Card";
import { IssueCodeButton } from "@/components/IssueCodeButton";

interface AttendanceStatusCardProps {
  eventId: string;
}

export async function AttendanceStatusCard({ eventId }: AttendanceStatusCardProps) {
  let confirmedCount: number;
  let attendedCount: number;
  let code: string | null;

  if (await isDemoMode()) {
    const row = DEMO_DASHBOARD_ROWS.find((r) => r.id === eventId);
    confirmedCount = row?.confirmed ?? 0;
    attendedCount = row?.attended ?? 0;
    code = "DEMO1234";
  } else {
    const supabase = await createClient();

    const [{ data: registrationsData }, { data: attendancesData }, { data: codeData }] =
      await Promise.all([
        supabase
          .from("event_registrations")
          .select("user_id, status")
          .eq("event_id", eventId),
        supabase.from("attendances").select("user_id").eq("event_id", eventId),
        supabase
          .from("event_codes")
          .select("code")
          .eq("event_id", eventId)
          .maybeSingle(),
      ]);

    const registrations = (registrationsData as { user_id: string; status: string }[]) ?? [];
    const attendedUserIds = new Set(
      (attendancesData ?? []).map((a) => a.user_id),
    );
    confirmedCount = registrations.filter((r) => r.status === "confirmed").length;
    attendedCount = registrations.filter(
      (r) => r.status === "confirmed" && attendedUserIds.has(r.user_id),
    ).length;
    code = codeData?.code ?? null;
  }

  const rate = confirmedCount > 0 ? Math.round((attendedCount / confirmedCount) * 100) : 0;

  let siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (!siteUrl) {
    // env 미설정 시 요청 헤더에서 origin 복구 (QR에 상대경로가 들어가는 것 방지)
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    if (host) siteUrl = `${proto}://${host}`;
  }
  const attendUrl = code
    ? `${siteUrl}/events/${eventId}?code=${code}`
    : null;
  const qrDataUrl = attendUrl ? await QRCode.toDataURL(attendUrl) : null;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 text-success"
        >
          <circle cx="10" cy="10" r="7.5" />
          <path d="M7 10l2 2 4-4.5" />
        </svg>
        <p className="text-sm font-semibold text-gray-900">출석 현황</p>
      </div>

      <div className="flex items-center gap-4 rounded-lg bg-primary-soft px-4 py-3">
        <div
          className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(var(--color-primary) ${rate * 3.6}deg, var(--color-gray-200) 0deg)`,
          }}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xs font-bold text-primary dark:bg-gray-100">
            {rate}%
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500">출석 / 확정</p>
          <p className="text-lg font-bold text-gray-900">
            {attendedCount}
            <span className="text-sm font-normal text-gray-400"> / {confirmedCount}명</span>
          </p>
        </div>
      </div>

      {code ? (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500">현재 출석 코드</p>
              <p className="font-mono text-xl font-bold tracking-widest text-gray-900">
                {code}
              </p>
            </div>
            <IssueCodeButton eventId={eventId} hasCode />
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3">
            <p className="text-xs text-gray-500">현재 출석 코드</p>
            <p className="text-sm text-gray-300">미발급</p>
          </div>
          <IssueCodeButton eventId={eventId} hasCode={false} />
        </>
      )}

      {qrDataUrl && attendUrl && (
        <div className="flex flex-col items-center gap-2 border-t border-gray-100 pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="출석 QR 코드" className="h-40 w-40" />
          <p className="font-mono text-xs text-gray-400">{attendUrl}</p>
          <p className="text-xs text-gray-400">
            행사장에서 QR을 띄워 참석자가 스캔하면 출석이 기록돼요.
          </p>
        </div>
      )}
    </Card>
  );
}
