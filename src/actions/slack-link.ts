"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { toKoreanError } from "@/lib/errors";
import { isDemoMode } from "@/lib/demo";
import type { ActionResult } from "@/lib/types";

/** slackUserId가 null이면 연결을 해제한다. */
export async function setSlackLink(
  userId: string,
  slackUserId: string | null,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  if (!userId) return { error: "회원을 선택해주세요" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ slack_user_id: slackUserId })
    .eq("id", userId);

  if (error) {
    // slack_user_id는 unique — 한 슬랙 계정을 두 회원에게 붙일 수 없다
    if ((error as { code?: string }).code === "23505") {
      return { error: "이미 다른 회원에게 연결된 슬랙 계정이에요" };
    }
    return { error: toKoreanError(error) };
  }

  revalidatePath("/admin/bots/links");
  return {};
}
