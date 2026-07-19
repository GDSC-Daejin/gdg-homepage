"use server";

import { requireAdmin } from "@/lib/auth";
import { computeAttendanceWarnings } from "@/lib/attendance-stats";
import { getCommunity } from "@/lib/community";
import { postSlack } from "@/lib/slack";
import type { ActionResult } from "@/lib/types";

export async function sendAttendanceWarning(): Promise<
  ActionResult & { count?: number }
> {
  await requireAdmin();
  const community = await getCommunity();
  const warnings = await computeAttendanceWarnings(community.attendance);

  if (warnings.length === 0) {
    return { count: 0 };
  }

  const lines = warnings
    .map((w) => `- ${w.name} (${Math.round(w.rate * 100)}%)`)
    .join("\n");
  const { error } = await postSlack(
    `[출석 경고] 출석률 50% 미만 회원 ${warnings.length}명\n${lines}`,
  );

  if (error) return { error };

  return { count: warnings.length };
}
