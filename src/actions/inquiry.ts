"use server";

import { revalidatePath } from "next/cache";
import { getCommunity } from "@/lib/community";
import { isDemoMode } from "@/lib/demo";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { inquirySchema } from "@/lib/schemas";
import { displayName } from "@/lib/format";
import { sendInquiryNotification } from "@/lib/inquiry-notification";
import type { ActionResult } from "@/lib/types";

export async function submitInquiry(formData: FormData): Promise<ActionResult> {
  const profile = await requireProfile();
  if (await isDemoMode()) return { error: "미리보기 모드에서는 문의를 등록할 수 없어요" };

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

  // 알림 실패로 문의 등록까지 실패시키지 않는다 — 운영진 채널로만 로그를 남긴다.
  const notified = await sendInquiryNotification({
    category: parsed.data.category,
    title: parsed.data.title,
    body: parsed.data.body,
    author: displayName(profile.name, profile.nickname),
    createdAt: new Date().toISOString(),
  });
  if (notified.error) console.warn("[submitInquiry] 슬랙 알림 실패 —", notified.error);

  revalidatePath("/inquiries");
  return {};
}

export async function answerInquiry(
  id: string,
  answer: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return { error: "미리보기 모드에서는 답변을 등록할 수 없어요" };

  const trimmed = answer.trim();
  if (trimmed.length < 1) return { error: "답변을 입력해주세요" };

  const community = await getCommunity();
  const result = await community.inquiries.ops.answer(id, trimmed);
  if (result.error) return result;

  revalidatePath("/admin/inquiries");
  return {};
}
