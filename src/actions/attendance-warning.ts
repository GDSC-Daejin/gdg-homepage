"use server";

import { requireAdmin } from "@/lib/auth";
import { sendAttendanceWarnings } from "@/lib/attendance-warning";
import { getCommunity } from "@/lib/community";
import { isDemoMode } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

export async function sendAttendanceWarning(): Promise<
  ActionResult & { count?: number; skipped?: boolean }
> {
  await requireAdmin();
  if (await isDemoMode()) return { count: 0, skipped: true };
  const community = await getCommunity();
  const { error, count, skipped } = await sendAttendanceWarnings(
    community.attendance,
    await createClient(),
  );

  if (error) return { error };

  return { count, skipped };
}
