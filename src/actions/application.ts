"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { applicationSchema } from "@/lib/schemas";
import { toKoreanError } from "@/lib/errors";
import { getRecruitingSettings } from "@/lib/recruiting";
import { isDemoMode } from "@/lib/demo";
import type { ActionResult, ApplicationStatus } from "@/lib/types";

export async function submitApplication(formData: FormData): Promise<ActionResult> {
  const settings = await getRecruitingSettings();
  if (!settings.is_open) {
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
  return {};
}
