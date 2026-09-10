"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getProfile, requireAdmin } from "@/lib/auth";
import { applicationSchema } from "@/lib/schemas";
import { toKoreanError } from "@/lib/errors";
import { getRecruitingSettings, isRecruitingOpen } from "@/lib/recruiting";
import { isDemoMode } from "@/lib/demo";
import { sendApplicationOnboardingInviteEmail, sendResultEmail } from "@/lib/email";
import { applicationInviteUrl, createApplicationInviteToken, hashApplicationInviteToken } from "@/lib/application-invite";
import { applicationEvaluationSchema } from "@/lib/schemas";
import type {
  ActionResult,
  ApplicationEvaluationStage,
  ApplicationStatus,
  EvaluationRecommendation,
} from "@/lib/types";
import { isStaff } from "@/lib/types";

const ONBOARDING_INVITE_DAYS = 7;

async function issueOnboardingInvite(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const token = createApplicationInviteToken();
  const expiresAt = new Date(
    Date.now() + ONBOARDING_INVITE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error } = await supabase.rpc("admin_issue_application_onboarding_invite", {
    p_application: id,
    p_token_hash: hashApplicationInviteToken(token),
    p_expires_at: expiresAt,
  });
  if (error) return { error: toKoreanError(error) };
  return { token, expiresAt };
}

export async function submitApplication(formData: FormData): Promise<ActionResult> {
  if (await isDemoMode()) return {};

  const settings = await getRecruitingSettings();
  if (!isRecruitingOpen(settings)) {
    return { error: "지금은 모집 기간이 아니에요" };
  }

  const answers = {
    intro: String(formData.get("intro") ?? "").trim(),
    motivation: String(formData.get("motivation") ?? "").trim(),
    interest: String(formData.get("interest") ?? "").trim(),
  };

  if (!answers.intro || !answers.motivation || !answers.interest) {
    return { error: "모든 항목을 입력해주세요" };
  }

  const parsed = applicationSchema.safeParse({
    applicant_name: String(formData.get("applicant_name") ?? "").trim(),
    student_no: String(formData.get("student_no") ?? "").trim(),
    major: String(formData.get("major") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    season: settings.season,
    answers,
    position: String(formData.get("position") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }
  if (!settings.open_positions.includes(parsed.data.position)) {
    return { error: "지금은 모집하지 않는 파트예요" };
  }

  const supabase = await createClient();

  // IP 기반 스로틀 (실제 폼 남용의 대부분 차단). Vercel은 x-forwarded-for 제공.
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const { data: allowed } = await supabase.rpc("check_submission_rate", {
    p_ip: ip ?? "",
  });
  if (allowed === false) {
    return { error: "잠시 후 다시 시도해주세요" };
  }

  const { error } = await supabase.from("applications").insert({
    applicant_id: null,
    applicant_name: parsed.data.applicant_name,
    student_no: parsed.data.student_no,
    major: parsed.data.major,
    phone: parsed.data.phone,
    email: parsed.data.email,
    season: parsed.data.season,
    answers: parsed.data.answers,
    position: parsed.data.position,
  });

  if (error) {
    if (error.code === "23505") return { error: "이미 지원한 이메일이에요" };
    return { error: toKoreanError(error) };
  }

  return {};
}

export async function setApplicationStatus(
  id: string,
  status: ApplicationStatus,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_application_status", {
    p_application: id,
    p_status: status,
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${id}`);

  let emailWarning: string | undefined;
  let onboardingUrl: string | undefined;
  if (status === "accepted" || status === "rejected") {
    const { data: application } = await supabase
      .from("applications")
      .select("applicant_name, email, season")
      .eq("id", id)
      .single();

    if (application?.email) {
      if (status === "accepted") {
        const invite = await issueOnboardingInvite(supabase, id);
        if ("error" in invite) {
          emailWarning = `합격 처리는 됐지만 가입 초대를 만들지 못했어요: ${invite.error}`;
        } else {
          onboardingUrl = applicationInviteUrl(invite.token);
        }
      }
      const result = await sendResultEmail({
        to: application.email,
        name: application.applicant_name,
        season: application.season,
        accepted: status === "accepted",
        onboardingUrl,
      });

      if (!result.skipped) {
        await supabase.rpc("admin_log_result_email", {
          p_application: id,
          p_detail: { status, to: application.email, sent: result.sent },
        });
      }

      if (!result.sent && !result.skipped) {
        emailWarning = "상태는 변경됐지만 결과 이메일 발송에 실패했어요";
      }
    }
  }

  if (emailWarning) return { warning: emailWarning };
  return {};
}

export async function resendApplicationResultEmail(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return { error: "미리보기 모드에서는 결과 이메일을 보낼 수 없어요" };

  const supabase = await createClient();
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("applicant_name, email, season, status, applicant_id")
    .eq("id", id)
    .single();
  if (applicationError || !application) return { error: "지원서를 찾을 수 없어요" };
  if (application.status !== "accepted" && application.status !== "rejected") {
    return { error: "최종 결정이 끝난 지원자만 결과 이메일을 보낼 수 있어요" };
  }
  if (!application.email) return { error: "지원자 이메일이 없어요" };

  let onboardingUrl: string | undefined;
  if (application.status === "accepted" && !application.applicant_id) {
    const invite = await issueOnboardingInvite(supabase, id);
    if ("error" in invite) return { error: invite.error };
    onboardingUrl = applicationInviteUrl(invite.token);
  }

  const result = await sendResultEmail({
    to: application.email,
    name: application.applicant_name,
    season: application.season,
    accepted: application.status === "accepted",
    onboardingUrl,
  });

  if (!result.skipped) {
    await supabase.rpc("admin_log_result_email", {
      p_application: id,
      p_detail: { status: application.status, to: application.email, sent: result.sent, retry: true },
    });
  }
  if (result.skipped) return { warning: "결과 이메일을 보내려면 Resend 설정이 필요해요" };
  if (!result.sent) return { warning: result.error ?? "결과 이메일 발송에 실패했어요" };
  revalidatePath(`/admin/applications/${id}`);
  revalidatePath("/admin/applications/conversions");
  return {};
}

export async function saveApplicationEvaluation(
  id: string,
  stage: ApplicationEvaluationStage,
  scores: Record<string, number>,
  recommendation: EvaluationRecommendation,
  note: string,
): Promise<ActionResult> {
  const evaluator = await requireAdmin();
  if (await isDemoMode()) return {};

  const parsed = applicationEvaluationSchema.safeParse({
    stage,
    scores,
    recommendation,
    note: note.trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "평가 내용을 확인해주세요" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("application_evaluations").upsert(
    {
      application_id: id,
      evaluator_id: evaluator.id,
      stage: parsed.data.stage,
      scores: parsed.data.scores,
      recommendation: parsed.data.recommendation,
      note: parsed.data.note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "application_id,evaluator_id,stage" },
  );
  if (error) return { error: toKoreanError(error) };

  revalidatePath(`/admin/applications/${id}`);
  revalidatePath("/admin/applications/conversions");
  return {};
}

export async function reopenInterview(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reopen_interview", { p_application: id });
  if (error) return { error: toKoreanError(error) };

  revalidatePath(`/admin/applications/${id}`);
  revalidatePath("/admin/applications");
  revalidatePath("/admin/interviews");
  return {};
}

export async function resendApplicationInvite(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return { error: "미리보기 모드에서는 가입 초대를 보낼 수 없어요" };

  const supabase = await createClient();
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("applicant_name, email, season, status")
    .eq("id", id)
    .single();
  if (applicationError || !application || application.status !== "accepted") {
    return { error: "합격 상태인 지원자만 가입 초대를 보낼 수 있어요" };
  }

  const invite = await issueOnboardingInvite(supabase, id);
  if ("error" in invite) return { error: invite.error };

  const result = await sendApplicationOnboardingInviteEmail({
    to: application.email,
    name: application.applicant_name,
    season: application.season,
    onboardingUrl: applicationInviteUrl(invite.token),
  });
  revalidatePath("/admin/applications/conversions");
  if (result.skipped) return { warning: "가입 초대는 갱신됐지만 Resend 설정이 없어 이메일을 보내지 못했어요" };
  if (!result.sent) return { warning: "가입 초대는 갱신됐지만 이메일 발송에 실패했어요" };
  return {};
}

export async function linkApplicationAccount(token: string): Promise<ActionResult> {
  const profile = await getProfile();
  if (!profile) return { error: "로그인이 필요해요" };
  if (isStaff(profile)) return { error: "운영진 계정으로는 합격자 가입 연결을 할 수 없어요" };
  if (await isDemoMode()) return { error: "미리보기 모드에서는 가입 연결을 할 수 없어요" };
  if (!token.trim()) return { error: "가입 초대 링크가 올바르지 않아요" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("link_application_to_profile", {
    p_token_hash: hashApplicationInviteToken(token),
  });
  if (error) return { error: toKoreanError(error) };

  revalidatePath("/onboarding");
  revalidatePath("/admin/applications/conversions");
  return {};
}

export async function setApplicationNote(id: string, note: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_application_note", {
    p_application: id,
    p_note: note.trim(),
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath(`/admin/applications/${id}`);
  return {};
}
