import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import type { Application, ApplicationEmailLog, ApplicationStatus, InterviewSlot } from "@/lib/types";
import { POSITION_LABELS } from "@/lib/types";
import { ReviewPanel } from "./ReviewPanel";
import { EvaluationPanel } from "./EvaluationPanel";
import { isDemoMode } from "@/lib/demo";
import { DEMO_APPLICATIONS, DEMO_APPLICATION_EMAIL_LOGS, DEMO_APPLICATION_EVALUATIONS, DEMO_APPLICATION_STATUS_HISTORY, DEMO_INTERVIEW_BOOKING_EVENTS, DEMO_INTERVIEW_SLOTS, DEMO_MEMBERS } from "@/lib/demoData";
import { getInterviewQuestionsFor } from "@/lib/interview-questions";
import { getApplicationQuestionsFor } from "@/lib/application-questions";
import type { ApplicationQuestion } from "@/lib/types";
import { CancellationEmailRetryButton } from "./CancellationEmailRetryButton";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  waiting: "지원 접수",
  reviewing: "서류 검토",
  pending: "면접 단계",
  accepted: "합격",
  rejected: "불합격",
  no_show: "면접 노쇼",
  withdrawn: "지원 철회",
};

const STATUS_TONE: Record<ApplicationStatus, "neutral" | "warning" | "success" | "danger"> = {
  waiting: "warning",
  reviewing: "warning",
  pending: "warning",
  accepted: "success",
  rejected: "danger",
  no_show: "danger",
  withdrawn: "neutral",
};

const STATUS_DOT: Record<ApplicationStatus, string> = {
  waiting: "bg-warning",
  reviewing: "bg-warning",
  pending: "bg-warning",
  accepted: "bg-success",
  rejected: "bg-danger",
  no_show: "bg-danger",
  withdrawn: "bg-gray-400",
};

const LEGACY_QUESTIONS: { key: string; label: string }[] = [
  { key: "intro", label: "자기소개" },
  { key: "motivation", label: "지원 동기" },
  { key: "interest", label: "관심 분야" },
];

const INTERVIEW_EVENT_LABELS: Record<string, string> = {
  booked: "면접 예약",
  rescheduled: "면접 일정 변경",
  canceled_by_applicant: "지원자 취소",
  canceled_by_admin: "운영진 취소",
  attended: "면접 참석",
  no_show: "면접 노쇼",
};

const EMAIL_KIND_LABELS: Record<ApplicationEmailLog["kind"], string> = {
  interview_invite: "면접 예약 안내",
  interview_confirmation: "면접 확정 안내",
  interview_cancellation: "면접 취소 안내",
  result: "전형 결과 안내",
  onboarding_invite: "가입 초대",
};

const EMAIL_STATUS_LABELS: Record<ApplicationEmailLog["status"], string> = {
  not_configured: "설정 필요",
  requested: "발송 요청",
  delivered: "수신 서버 전달 완료",
  delivery_delayed: "전달 지연",
  failed: "발송 실패",
  bounced: "반송",
  complained: "스팸 신고",
  suppressed: "발송 차단",
};

const CALENDAR_RESPONSE_LABELS: Record<NonNullable<InterviewSlot["applicant_calendar_response"]>, string> = {
  needsAction: "응답 대기",
  accepted: "수락",
  tentative: "미정",
  declined: "거절",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function AdminApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const demo = await isDemoMode();

  let app: Application | undefined;
  let reviewerName: string | null = null;
  let rank = 0;
  let total = 0;
  let interviewSlot: InterviewSlot | undefined;
  let emailLogs: ApplicationEmailLog[] = [];

  if (demo) {
    app = DEMO_APPLICATIONS.find((a) => a.id === id) ?? DEMO_APPLICATIONS[0];
    if (app) {
      const seasonApps = DEMO_APPLICATIONS.filter((a) => a.season === app!.season).sort(
        (a, b) => a.created_at.localeCompare(b.created_at),
      );
      total = seasonApps.length;
      rank = seasonApps.findIndex((a) => a.id === app!.id) + 1;
      reviewerName =
        DEMO_MEMBERS.find((m) => m.id === app!.reviewed_by)?.name ?? null;
    }
  } else {
    const supabase = await createClient();
    const { data } = await supabase
      .from("applications")
      .select("*")
      .eq("id", id)
      .single();

    if (!data) notFound();
    app = data as Application;

    const { data: seasonRows } = await supabase
      .from("applications")
      .select("id")
      .eq("season", app.season)
      .order("created_at", { ascending: true });
    const ids = ((seasonRows as { id: string }[] | null) ?? []).map((r) => r.id);
    total = ids.length;
    rank = ids.indexOf(app.id) + 1;

    if (app.reviewed_by) {
      const { data: reviewer } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", app.reviewed_by)
        .single();
      reviewerName = (reviewer as { name: string } | null)?.name ?? null;
    }

    const [{ data: slot }, { data: logs }] = await Promise.all([
      supabase.from("interview_slots").select("*").eq("application_id", app.id).order("starts_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("application_email_logs").select("*").eq("application_id", app.id).order("created_at", { ascending: false }),
    ]);
    interviewSlot = (slot as InterviewSlot | null) ?? undefined;
    emailLogs = (logs as ApplicationEmailLog[] | null) ?? [];
  }

  if (!app) notFound();

  if (demo) {
    interviewSlot = DEMO_INTERVIEW_SLOTS.find((slot) => slot.application_id === app!.id);
    emailLogs = DEMO_APPLICATION_EMAIL_LOGS.filter((log) => log.application_id === app!.id);
  }

  const interviewQuestions = await getInterviewQuestionsFor(app.position);
  const configuredApplicationQuestions = app.position
    ? await getApplicationQuestionsFor(app.position)
    : [];
  const applicationQuestions: { key: string; label: string }[] = configuredApplicationQuestions.length
    ? configuredApplicationQuestions.map((question: ApplicationQuestion) => ({ key: question.id, label: question.label }))
    : LEGACY_QUESTIONS;
  const { data: interviewHistory } = demo
    ? { data: DEMO_INTERVIEW_BOOKING_EVENTS.filter((event) => event.application_id === app.id) }
    : await (await createClient())
        .from("interview_booking_events")
        .select("id, slot_id, new_slot_id, action, actor_type, reason, created_at")
        .eq("application_id", app.id)
        .order("created_at", { ascending: false });
  const { data: evaluationData } = demo
    ? { data: DEMO_APPLICATION_EVALUATIONS.filter((evaluation) => evaluation.application_id === app.id) }
    : await (await createClient())
        .from("application_evaluations")
        .select("*")
        .eq("application_id", app.id)
        .order("stage")
        .order("updated_at", { ascending: false });
  const { data: statusHistory } = demo
    ? { data: DEMO_APPLICATION_STATUS_HISTORY.filter((event) => event.application_id === app.id) }
    : await (await createClient())
        .from("application_status_history")
        .select("id, from_status, to_status, actor_type, reason, created_at")
        .eq("application_id", app.id)
        .order("created_at", { ascending: false });

  const name = app.applicant_name || "알 수 없음";
  const studentNo = app.student_no || "정보 없음";
  const positionLabel = app.position ? POSITION_LABELS[app.position] : "미지정";
  const initial = app.applicant_name ? app.applicant_name.charAt(0) : "?";
  const isUnknown = !app.applicant_name;

  const info: { label: string; value: string }[] = [
    { label: "직군", value: positionLabel },
    { label: "학번", value: studentNo },
    { label: "제출일", value: formatDate(app.created_at) },
    { label: "이메일", value: app.email || "이메일 없음" },
    { label: "연락처", value: app.phone || "전화번호 없음" },
  ];

  return (
    <Card className="flex flex-col gap-8 p-6 sm:p-8">
      <Link
        href={`/admin/applications?season=${app.season}`}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M12 5l-5 5 5 5" />
        </svg>
        목록으로
      </Link>

      <div className="flex items-center gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-semibold ${
            isUnknown ? "bg-gray-100 text-gray-400" : "bg-primary-soft text-primary"
          }`}
        >
          {initial}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{name}</h1>
            <Badge tone={app.position ? "primary" : "neutral"}>{positionLabel}</Badge>
            <Badge tone={STATUS_TONE[app.status]}>{STATUS_LABEL[app.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {studentNo} · 제출 {formatDate(app.created_at)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-700">지원 문항 답변</p>
          {applicationQuestions.map((q, i) => (
            <div
              key={q.key}
              className="rounded-lg border border-gray-100 bg-gray-50 p-4"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <span className="text-primary">Q{i + 1}</span>
                {q.label}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                {app.answers[q.key] || "-"}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900">지원자 정보</p>
            <dl className="mt-3 flex flex-col gap-2">
              {info.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-gray-500">{row.label}</dt>
                  <dd className="truncate text-right text-sm font-medium text-gray-900">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900">심사 현황</p>
            <dl className="mt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs text-gray-500">현재 상태</dt>
                <dd className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-900">
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[app.status]}`} />
                  {STATUS_LABEL[app.status]}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs text-gray-500">심사자</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {reviewerName ?? "미배정"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs text-gray-500">지원 순번</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {rank > 0 ? `${rank} / ${total}` : "-"}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-gray-700">
          면접 질문
          <span className="ml-2 text-xs font-normal text-gray-400">
            {positionLabel} · 공통 포함
          </span>
        </p>
        {interviewQuestions.length === 0 ? (
          <p className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-400">
            등록된 면접 질문이 없어요. 면접 질문 메뉴에서 추가할 수 있어요.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {interviewQuestions.map((q, i) => (
              <li
                key={q.id}
                className="flex gap-2 rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-800"
              >
                <span className="font-semibold text-primary">Q{i + 1}</span>
                <span className="whitespace-pre-wrap">{q.body}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-gray-700">면접 이력</p>
        {!interviewHistory?.length ? (
          <p className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-400">
            기록된 면접 이력이 없어요.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {(interviewHistory as {
              id: string;
              action: string;
              actor_type: string;
              reason: string;
              created_at: string;
            }[]).map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                <span className="flex min-w-0 flex-col gap-0.5 font-medium text-gray-800">
                  <span>{INTERVIEW_EVENT_LABELS[event.action] ?? event.action}</span>
                  {event.reason && <span className="text-xs font-normal text-gray-500">사유: {event.reason}</span>}
                </span>
                  <span className="text-xs text-gray-500">
                    {event.actor_type === "admin" ? "운영진" : "지원자"} · {formatDateTime(event.created_at)}
                  </span>
                  {(event.action === "canceled_by_applicant" || event.action === "canceled_by_admin") && (
                    <CancellationEmailRetryButton eventId={event.id} />
                  )}
                </li>
            ))}
          </ol>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-700">면접 연동 현황</p>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm">
            {!interviewSlot ? (
              <p className="text-gray-400">예약된 면접이 없어요.</p>
            ) : (
              <dl className="flex flex-col gap-2">
                <div className="flex justify-between gap-3"><dt className="text-gray-500">면접 일정</dt><dd className="font-medium text-gray-800">{formatDateTime(interviewSlot.starts_at)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-500">Calendar 생성</dt><dd className="font-medium text-gray-800">{interviewSlot.calendar_sync_status === "synced" ? "동기화 완료" : interviewSlot.calendar_sync_status === "failed" ? "동기화 실패" : "미동기화"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-500">지원자 응답</dt><dd className="font-medium text-gray-800">{interviewSlot.applicant_calendar_response ? CALENDAR_RESPONSE_LABELS[interviewSlot.applicant_calendar_response] : "응답 대기"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-500">면접관 응답</dt><dd className="font-medium text-gray-800">{interviewSlot.interviewer_calendar_response ? CALENDAR_RESPONSE_LABELS[interviewSlot.interviewer_calendar_response] : "응답 대기"}</dd></div>
                {interviewSlot.calendar_error && <div className="text-xs text-danger">오류: {interviewSlot.calendar_error}</div>}
              </dl>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-700">이메일 발송·수신 현황</p>
          {!emailLogs.length ? (
            <p className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-400">기록된 이메일이 없어요.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {emailLogs.map((log) => (
                <li key={log.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-gray-800">{EMAIL_KIND_LABELS[log.kind]}</span>
                    <Badge tone={log.status === "delivered" ? "success" : log.status === "requested" ? "warning" : log.status === "bounced" || log.status === "failed" ? "danger" : "neutral"}>
                      {EMAIL_STATUS_LABELS[log.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{log.recipient_email} · {formatDateTime(log.created_at)}</p>
                  {log.error && <p className="mt-1 text-xs text-danger">{log.error}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-gray-700">지원서 상태 이력</p>
        {!statusHistory?.length ? (
          <p className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-400">
            기록된 상태 변경이 없어요.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {(statusHistory as {
              id: string;
              from_status: string | null;
              to_status: ApplicationStatus;
              actor_type: string;
              reason: string;
              created_at: string;
            }[]).map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                <span className="font-medium text-gray-800">
                  {event.from_status ? `${STATUS_LABEL[event.from_status as ApplicationStatus] ?? event.from_status} → ` : "초기 상태 → "}
                  {STATUS_LABEL[event.to_status] ?? event.to_status}
                  {event.reason && <span className="ml-2 font-normal text-gray-500">{event.reason}</span>}
                </span>
                <span className="shrink-0 text-xs text-gray-500">
                  {event.actor_type === "admin" ? "운영진" : "시스템"} · {formatDateTime(event.created_at)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="border-t border-gray-100 pt-6">
        <EvaluationPanel
          applicationId={app.id}
          evaluatorId={admin.id}
          evaluations={(evaluationData ?? []) as import("@/lib/types").ApplicationEvaluation[]}
        />
      </div>

      <div className="border-t border-gray-100 pt-6">
        <ReviewPanel id={app.id} status={app.status} note={app.review_note} />
      </div>
    </Card>
  );
}
