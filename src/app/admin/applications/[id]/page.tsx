import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import type { Application, ApplicationStatus } from "@/lib/types";
import { POSITION_LABELS } from "@/lib/types";
import { StatusSelector } from "../StatusSelector";
import { ReviewNoteForm } from "./ReviewNoteForm";
import { isDemoMode } from "@/lib/demo";
import { DEMO_APPLICATIONS } from "@/lib/demoData";

export const dynamic = "force-dynamic";

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

const ANSWER_FIELDS: { key: string; label: string }[] = [
  { key: "intro", label: "자기소개" },
  { key: "motivation", label: "지원 동기" },
  { key: "interest", label: "관심 분야" },
];

export default async function AdminApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const demo = await isDemoMode();

  let app: Application | undefined;

  if (demo) {
    app = DEMO_APPLICATIONS.find((a) => a.id === id) ?? DEMO_APPLICATIONS[0];
  } else {
    const supabase = await createClient();
    const { data } = await supabase
      .from("applications")
      .select("*")
      .eq("id", id)
      .single();

    if (!data) notFound();
    app = data as Application;
  }

  if (!app) notFound();

  const name = app.applicant_name || "알 수 없음";
  const studentNo = app.student_no || "정보 없음";
  const major = app.major || "정보 없음";
  const initial = app.applicant_name ? app.applicant_name.charAt(0) : "?";
  const isUnknown = !app.applicant_name;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/admin/applications?season=${app.season}`}
        className="text-xs text-gray-500 hover:text-gray-700"
      >
        지원서 심사 <span className="mx-1">&gt;</span> {name}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-semibold ${
              isUnknown ? "bg-gray-100 text-gray-400" : "bg-primary-soft text-primary"
            }`}
          >
            {initial}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{name}</h1>
            <p className="text-sm text-gray-500">
              {isUnknown ? "프로필 정보 없음" : `${studentNo} · ${major}`}
            </p>
          </div>
        </div>
        <Badge tone={STATUS_TONE[app.status]} className="mt-1 shrink-0">
          {STATUS_LABEL[app.status]}
        </Badge>
      </div>

      <Card className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500">연락처</p>
          <p className="mt-1 text-sm text-gray-700">{app.phone || "전화번호 없음"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">이메일</p>
          <p className="mt-1 text-sm text-gray-700">{app.email || "이메일 없음"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">지원 파트</p>
          <p className="mt-1 text-sm text-gray-700">
            {app.position ? POSITION_LABELS[app.position] : "미지정"}
          </p>
        </div>
        {ANSWER_FIELDS.map((field) => (
          <div key={field.key}>
            <p className="text-xs font-medium text-gray-500">{field.label}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
              {app.answers[field.key] || "-"}
            </p>
          </div>
        ))}
      </Card>

      <Card>
        <ReviewNoteForm id={app.id} note={app.review_note} />
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-700">심사 상태</p>
        <StatusSelector id={app.id} status={app.status} />
      </div>
    </div>
  );
}
