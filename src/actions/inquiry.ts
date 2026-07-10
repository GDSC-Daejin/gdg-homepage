"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { inquirySchema } from "@/lib/schemas";
import { toKoreanError } from "@/lib/errors";
import { isDemoMode } from "@/lib/demo";
import type { ActionResult } from "@/lib/types";

export async function submitInquiry(formData: FormData): Promise<ActionResult> {
  const profile = await requireProfile();

  const parsed = inquirySchema.safeParse({
    title: String(formData.get("title") ?? "").trim(),
    body: String(formData.get("body") ?? "").trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("inquiries").insert({
    user_id: profile.id,
    title: parsed.data.title,
    body: parsed.data.body,
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/inquiries");
  return {};
}

export async function answerInquiry(
  id: string,
  answer: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const trimmed = answer.trim();
  if (trimmed.length < 1) return { error: "답변을 입력해주세요" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_answer_inquiry", {
    p_inquiry: id,
    p_answer: trimmed,
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/inquiries");
  return {};
}
