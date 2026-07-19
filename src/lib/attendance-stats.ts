import type { AttendanceReads } from "@/lib/community/types";
import { ATTENDANCE_WARNING_THRESHOLD } from "@/app/admin/attendance/constants";

export async function computeAttendanceWarnings(
  reads: AttendanceReads,
): Promise<{ userId: string; name: string; rate: number }[]> {
  const now = new Date().toISOString();

  const [members, pastEventIds] = await Promise.all([
    reads.activeMembers(),
    reads.pastEventIds(now),
  ]);

  const confirmedByUser = new Map<string, number>();
  const attendedByUser = new Map<string, number>();

  if (pastEventIds.length > 0) {
    const [regs, attends] = await Promise.all([
      reads.confirmedRegistrations(pastEventIds),
      reads.attendances(pastEventIds),
    ]);
    const confirmedPairs = new Set<string>();
    for (const r of regs) {
      confirmedPairs.add(`${r.user_id}:${r.event_id}`);
      confirmedByUser.set(r.user_id, (confirmedByUser.get(r.user_id) ?? 0) + 1);
    }
    for (const a of attends) {
      if (confirmedPairs.has(`${a.user_id}:${a.event_id}`)) {
        attendedByUser.set(a.user_id, (attendedByUser.get(a.user_id) ?? 0) + 1);
      }
    }
  }

  const warnings: { userId: string; name: string; rate: number }[] = [];
  for (const member of members) {
    const confirmed = confirmedByUser.get(member.id) ?? 0;
    if (confirmed === 0) continue;
    const attended = attendedByUser.get(member.id) ?? 0;
    const rate = attended / confirmed;
    if (rate < ATTENDANCE_WARNING_THRESHOLD) {
      warnings.push({ userId: member.id, name: member.name, rate });
    }
  }

  return warnings;
}
