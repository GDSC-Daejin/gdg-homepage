import type { ApplicationStatus, EventType, Position } from "@/lib/types";

export interface DashboardMonth {
  key: string;
  label: string;
  startUtc: Date;
}

export interface RecentEventRow {
  id: string;
  title: string;
  type: EventType;
  starts_at: string;
  confirmed: number;
  attended: number;
  rate: number | null;
}

export interface RecruitingCounts {
  total: number;
  waiting: number;
  pending: number;
  accepted: number;
  rejected: number;
  frontend: number;
  backend: number;
  designer: number;
  beginner: number;
  unassigned: number;
}

export function recentEventRows(
  events: Pick<RecentEventRow, "id" | "title" | "type" | "starts_at">[],
  registrations: { user_id: string; event_id: string }[],
  attendances: { user_id: string; event_id: string }[],
): RecentEventRow[] {
  const confirmedByEvent = new Map<string, number>();
  const attendedByEvent = new Map<string, number>();
  const confirmedPairs = new Set<string>();

  for (const registration of registrations) {
    confirmedPairs.add(`${registration.user_id}:${registration.event_id}`);
    confirmedByEvent.set(
      registration.event_id,
      (confirmedByEvent.get(registration.event_id) ?? 0) + 1,
    );
  }
  for (const attendance of attendances) {
    if (!confirmedPairs.has(`${attendance.user_id}:${attendance.event_id}`)) continue;
    attendedByEvent.set(
      attendance.event_id,
      (attendedByEvent.get(attendance.event_id) ?? 0) + 1,
    );
  }

  return events.map((event) => {
    const confirmed = confirmedByEvent.get(event.id) ?? 0;
    const attended = attendedByEvent.get(event.id) ?? 0;
    return { ...event, confirmed, attended, rate: confirmed > 0 ? attended / confirmed : null };
  });
}

export function countApplications(
  applications: { status: ApplicationStatus; position: Position | null }[],
): RecruitingCounts {
  return {
    total: applications.length,
    waiting: applications.filter((application) => application.status === "waiting").length,
    pending: applications.filter((application) => application.status === "pending").length,
    accepted: applications.filter((application) => application.status === "accepted").length,
    rejected: applications.filter((application) => application.status === "rejected").length,
    frontend: applications.filter((application) => application.position === "frontend").length,
    backend: applications.filter((application) => application.position === "backend").length,
    designer: applications.filter((application) => application.position === "designer").length,
    beginner: applications.filter((application) => application.position === "beginner").length,
    unassigned: applications.filter((application) => application.position === null).length,
  };
}

export function recentMonths(now = new Date()): DashboardMonth[] {
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return Array.from({ length: 6 }, (_, index) => {
    const first = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth() - (5 - index), 1);
    const date = new Date(first);
    return {
      key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      label: `${date.getUTCMonth() + 1}월`,
      startUtc: new Date(first - 9 * 60 * 60 * 1000),
    };
  });
}
