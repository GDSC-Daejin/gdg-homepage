"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { toKoreanError } from "@/lib/errors";
import { isDemoMode } from "@/lib/demo";
import type { ActionResult } from "@/lib/types";

/**
 * slackUserId가 null이면 연결을 해제한다.
 * profiles 쓰기는 봉인돼 있어(컬럼 화이트리스트 + self update 정책) RPC를 경유한다.
 */
export async function setSlackLink(
  userId: string,
  slackUserId: string | null,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  if (!userId) return { error: "회원을 선택해주세요" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_slack_link", {
    p_user: userId,
    p_slack: slackUserId,
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/bots/links");
  return {};
}
