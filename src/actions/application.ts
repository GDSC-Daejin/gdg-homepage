"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, requireAdmin } from "@/lib/auth";
import { applicationSchema } from "@/lib/schemas";
import { toKoreanError } from "@/lib/errors";
import { CURRENT_SEASON } from "@/lib/constants";
import type { ActionResult } from "@/lib/types";

export async function submitApplication(formData: FormData): Promise<ActionResult> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "applicant") return { error: "이미 회원입니다" };

  const answers = {
    intro: String(formData.get("intro") ?? "").trim(),
    motivation: String(formData.get("motivation") ?? "").trim(),
    interest: String(formData.get("interest") ?? "").trim(),
  };

  if (!answers.intro || !answers.motivation || !answers.interest) {
    return { error: "모든 항목을 입력해주세요" };
  }

  const parsed = applicationSchema.safeParse({ season: CURRENT_SEASON, answers });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("applications").insert({
    applicant_id: profile.id,
    season: parsed.data.season,
    answers: parsed.data.answers,
  });

  if (error) {
    if (error.code === "23505") return { error: "이번 시즌에 이미 지원했어요" };
    return { error: toKoreanError(error) };
  }

  revalidatePath("/apply");
  return {};
}

export async function reviewApplication(
  id: string,
  status: "accepted" | "rejected",
): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_application", {
    p_application: id,
    p_status: status,
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/applications");
  return {};
}
