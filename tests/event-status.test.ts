import { describe, expect, it } from "vitest";
import { isEventPast } from "@/lib/event-status";

const event = {
  id: "event-1",
  type: "session" as const,
  title: "정기세션",
  description: "",
  starts_at: "2026-08-05T01:00:00.000Z",
  ends_at: null,
  location: "",
  address: "",
  speaker: "",
  capacity: null,
  created_by: "user-1",
  created_at: "2026-08-01T00:00:00.000Z",
};

describe("이벤트 종료 상태", () => {
  it("종료 시각이 지나면 지난 일정으로 분류한다", () => {
    expect(
      isEventPast(
        { ...event, ends_at: "2026-08-05T02:00:00.000Z" },
        new Date("2026-08-05T02:00:01.000Z"),
      ),
    ).toBe(true);
  });

  it("종료 시각이 없으면 시작 시각이 지나면 지난 일정으로 분류한다", () => {
    expect(isEventPast(event, new Date("2026-08-05T01:00:01.000Z"))).toBe(true);
  });
});
