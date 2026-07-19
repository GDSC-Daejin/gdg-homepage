"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { applicationSchema } from "@/lib/schemas";
import { toKoreanError } from "@/lib/errors";
import { getRecruitingSettings, isRecruitingOpen } from "@/lib/recruiting";
import { isDemoMode } from "@/lib/demo";
import { sendResultEmail } from "@/lib/email";
import type { ActionResult, ApplicationStatus } from "@/lib/types";

export async function submitApplication(formData: FormData): Promise<ActionResult> {
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
  if (status === "accepted" || status === "rejected") {
    const { data: application } = await supabase
      .from("applications")
      .select("applicant_name, email, season")
      .eq("id", id)
      .single();

    if (application?.email) {
      const result = await sendResultEmail({
        to: application.email,
        name: application.applicant_name,
        season: application.season,
        accepted: status === "accepted",
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
