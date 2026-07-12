import Link from "next/link";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import type { Application, ApplicationStatus } from "@/lib/types";
import { POSITION_LABELS } from "@/lib/types";

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  waiting: "심사 대기",
  pending: "심사 중",
  accepted: "합격",
  rejected: "불합격",
};

const STATUS_TONE: Record<ApplicationStatus, "neutral" | "warning" | "success" | "danger"> = {
  waiting: "neutral",
  pending: "warning",
  accepted: "success",
  rejected: "danger",
};

const STATUS_ICON: Record<ApplicationStatus, React.ReactNode> = {
  waiting: (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3"
    >
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.5V10l2.5 1.5" />
    </svg>
  ),
  pending: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
      <path d="M10 2.5c.3 2.6 1.4 3.7 4 4-2.6.3-3.7 1.4-4 4-.3-2.6-1.4-3.7-4-4 2.6-.3 3.7-1.4 4-4Z" />
    </svg>
  ),
  accepted: (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3"
    >
      <circle cx="10" cy="10" r="7" />
      <path d="m7 10 2 2 4-4" />
    </svg>
  ),
  rejected: (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3"
    >
      <circle cx="10" cy="10" r="7" />
      <path d="M8 8l4 4M12 8l-4 4" />
    </svg>
  ),
};

export function ApplicationCard({
  application,
}: {
  application: Application;
}) {
  const name = application.applicant_name || "알 수 없음";
  const studentNo = application.student_no || "정보 없음";
  const major = application.major || "정보 없음";
  const initial = application.applicant_name ? application.applicant_name.charAt(0) : "?";
  const isUnknown = !application.applicant_name;

  return (
    <Link href={`/admin/applications/${application.id}`} className="block">
      <Card className="transition-colors hover:border-gray-300 hover:bg-gray-50">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
              isUnknown ? "bg-gray-100 text-gray-400" : "bg-primary-soft text-primary"
            }`}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-gray-900">
                {name}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  {isUnknown ? "프로필 정보 없음" : `${studentNo} · ${major}`}
                </span>
              </p>
              <div className="mt-0.5 flex shrink-0 flex-col items-end gap-1">
                <Badge tone={STATUS_TONE[application.status]} className="gap-1">
                  {STATUS_ICON[application.status]}
                  {STATUS_LABEL[application.status]}
                </Badge>
                <Badge tone={application.position ? "primary" : "neutral"}>
                  {application.position ? POSITION_LABELS[application.position] : "미지정"}
                </Badge>
              </div>
            </div>

            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-gray-400">관심 분야</dt>
              <dd className="text-gray-700">{application.answers.interest || "-"}</dd>
              <dt className="text-gray-400">연락처</dt>
              <dd className="truncate text-gray-700">{application.phone || "전화번호 없음"}</dd>
              <dt className="text-gray-400">이메일</dt>
              <dd className="truncate text-gray-700">{application.email || "이메일 없음"}</dd>
            </dl>

            {isUnknown && (
              <p className="mt-3 flex items-start gap-1.5 rounded-md bg-gray-50 px-2.5 py-2 text-xs text-gray-500">
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-px h-3.5 w-3.5 shrink-0"
                >
                  <circle cx="10" cy="10" r="7.5" />
                  <path d="M10 13.5v-4M10 6.5h.01" />
                </svg>
                지원자 정보가 없어요. 답변만 확인해 심사할 수 있어요.
              </p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
