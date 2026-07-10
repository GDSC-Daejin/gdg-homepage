"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { toKoreanError } from "@/lib/errors";
import { pointGrantSchema } from "@/lib/schemas";
import { isDemoMode } from "@/lib/demo";
import type { ActionResult } from "@/lib/types";

function isDuplicateError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export async function grantPoints(
  userId: string,
  amount: number,
  reason: string,
  eventId?: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  if (!userId) return { error: "회원을 선택해주세요" };

  const parsed = pointGrantSchema.safeParse({ amount, reason });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_grant_points", {
    p_user: userId,
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
    p_event: eventId || null,
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/points");
  revalidatePath("/profile");
  return {};
}

export async function createBadge(
  name: string,
  description: string,
  icon: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  if (!name.trim()) return { error: "이름을 입력해주세요" };
  if (!icon.trim()) return { error: "이모지를 입력해주세요" };

  const supabase = await createClient();
  const { error } = await supabase.from("badges").insert({
    name: name.trim(),
    description: description.trim(),
    icon: icon.trim(),
  });

  if (error) {
    if (isDuplicateError(error)) return { error: "이미 있는 뱃지 이름이에요" };
    return { error: toKoreanError(error) };
  }

  revalidatePath("/admin/points");
  return {};
}

export async function deleteBadge(badgeId: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { error } = await supabase.from("badges").delete().eq("id", badgeId);

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/points");
  return {};
}

export async function awardBadge(
  userId: string,
  badgeId: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  if (!userId || !badgeId) return { error: "회원과 뱃지를 선택해주세요" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_award_badge", {
    p_user: userId,
    p_badge: badgeId,
  });

  if (error) {
    if (isDuplicateError(error)) return { error: "이미 보유한 뱃지예요" };
    return { error: toKoreanError(error) };
  }

  revalidatePath("/admin/points");
  revalidatePath("/profile");
  return {};
}
