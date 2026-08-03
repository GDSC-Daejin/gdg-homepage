import { describe, expect, it } from "vitest";
import { buildCalendarProjection } from "@/app/admin/events/calendar-data";
import type { Event } from "@/lib/types";

const event = {
  id: "event-1",
  type: "session",
  title: "정기 세션",
  starts_at: "2026-08-03T10:00:00.000Z",
  location: "대진대학교",
} as Event;

describe("buildCalendarProjection", () => {
  it("Event·Interview·Meeting을 날짜순 다가오는 일정과 월 요약으로 투영한다", () => {
    const projection = buildCalendarProjection({
      events: [event],
      interviews: [{ id: "interview-1", starts_at: "2026-08-04T01:00:00.000Z", status: "booked" }],
      meetings: [{ id: "meeting-1", title: "모지숲", starts_at: "2026-08-05T01:00:00.000Z", duration_min: 60 }],
      month: "2026-08",
      today: "2026-08-03",
    });

    expect(projection.totalCount).toBe(3);
    expect(projection.legend.map((item) => item.label)).toEqual(["정기세션", "면접", "회의"]);
    expect(projection.upcoming.map((item) => item.key)).toEqual([
      "event-1",
      "interview-2026-08-04",
      "meeting-meeting-1",
    ]);
  });
});
