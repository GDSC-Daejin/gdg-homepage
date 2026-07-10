"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { toKoreanError } from "@/lib/errors";
import { isDemoMode } from "@/lib/demo";
import type { ActionResult } from "@/lib/types";

export async function issueAttendanceCode(
  eventId: string,
): Promise<ActionResult & { code?: string }> {
  await requireAdmin();
  if (await isDemoMode()) return { code: "DEMO1234" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_event_code", {
    p_event_id: eventId,
  });

  if (error) return { error: toKoreanError(error) };

  return { code: data as string };
}
