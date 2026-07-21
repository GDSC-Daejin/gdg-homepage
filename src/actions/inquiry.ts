"use server";

import { revalidatePath } from "next/cache";
import { getCommunity } from "@/lib/community";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { inquirySchema } from "@/lib/schemas";
import type { ActionResult } from "@/lib/types";

export async function submitInquiry(formData: FormData): Promise<ActionResult> {
  const profile = await requireProfile();

  const parsed = inquirySchema.safeParse({
    category: String(formData.get("category") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    body: String(formData.get("body") ?? "").trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const community = await getCommunity();
  const result = await community.inquiries.ops.submit({
    user_id: profile.id,
    category: parsed.data.category,
    title: parsed.data.title,
    body: parsed.data.body,
  });
  if (result.error) return result;

  revalidatePath("/inquiries");
  return {};
}

export async function answerInquiry(
  id: string,
  answer: string,
): Promise<ActionResult> {
  await requireAdmin();

  const trimmed = answer.trim();
  if (trimmed.length < 1) return { error: "답변을 입력해주세요" };

  const community = await getCommunity();
  const result = await community.inquiries.ops.answer(id, trimmed);
  if (result.error) return result;

  revalidatePath("/admin/inquiries");
  return {};
}
