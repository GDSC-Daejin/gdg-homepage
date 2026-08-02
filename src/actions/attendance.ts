"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireAdmin } from "@/lib/auth";
import { toKoreanError } from "@/lib/errors";
import { isDemoMode } from "@/lib/demo";
import { attendCodeSchema } from "@/lib/schemas";
import type { ActionResult } from "@/lib/types";

export async function checkAttendance(
  eventId: string,
  code: string,
): Promise<ActionResult> {
  await requireProfile();
  if (await isDemoMode()) return {};

  const parsed = attendCodeSchema.safeParse(code);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("check_attendance", {
    p_event_id: eventId,
    p_code: parsed.data,
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/profile");
  revalidatePath("/attend");

  return {};
}

// 운영진이 신청자 목록에서 출석을 직접 체크/해제
export async function setAttendance(
  eventId: string,
  userId: string,
  present: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_attendance", {
    p_event_id: eventId,
    p_user_id: userId,
    p_present: present,
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/profile");

  return {};
}
