import Link from "next/link";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import type { Application } from "@/lib/types";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_TONES,
  POSITION_LABELS,
} from "@/lib/types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

export function ApplicationCard({
  application,
}: {
  application: Application;
}) {
  const name = application.applicant_name || "알 수 없음";
  const studentNo = application.student_no || "정보 없음";
  const positionLabel = application.position
    ? POSITION_LABELS[application.position]
    : "미지정";
  const initial = application.applicant_name ? application.applicant_name.charAt(0) : "?";
  const isUnknown = !application.applicant_name;
  const excerpt =
    application.answers.motivation ||
    application.answers.intro ||
    application.answers.interest ||
    "작성된 답변이 없어요";

  return (
    <Link href={`/admin/applications/${application.id}`} className="block">
      <Card className="flex h-full flex-col gap-3 p-5 transition-colors hover:border-gray-300 hover:bg-gray-50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                isUnknown ? "bg-gray-100 text-gray-400" : "bg-primary-soft text-primary"
              }`}
            >
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-gray-900">{name}</p>
              <p className="truncate text-xs text-gray-500">
                {isUnknown ? "프로필 정보 없음" : `${positionLabel} · ${studentNo}`}
              </p>
            </div>
          </div>
          <Badge tone={APPLICATION_STATUS_TONES[application.status]} className="shrink-0">
            {APPLICATION_STATUS_LABELS[application.status]}
          </Badge>
        </div>

        <p className="line-clamp-2 min-h-[2.5rem] text-sm text-gray-700">{excerpt}</p>

        <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-400">제출 {formatDate(application.created_at)}</p>
          <span className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white">
            심사하기
          </span>
        </div>
      </Card>
    </Link>
  );
}
