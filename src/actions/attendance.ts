"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { toKoreanError } from "@/lib/errors";
import { attendCodeSchema } from "@/lib/schemas";
import type { ActionResult } from "@/lib/types";

export async function checkAttendance(
  eventId: string,
  code: string,
): Promise<ActionResult> {
  await requireProfile();

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
