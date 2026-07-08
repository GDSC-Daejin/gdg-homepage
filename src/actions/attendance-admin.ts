"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { toKoreanError } from "@/lib/errors";
import type { ActionResult } from "@/lib/types";

export async function issueAttendanceCode(
  eventId: string,
): Promise<ActionResult & { code?: string }> {
  await requireAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_event_code", {
    p_event_id: eventId,
  });

  if (error) return { error: toKoreanError(error) };

  return { code: data as string };
}
