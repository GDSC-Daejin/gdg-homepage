import { describe, expect, it } from "vitest";
import { buildEventReminderMessage } from "@/lib/event-reminder";
import type { Event } from "@/lib/types";

function fakeEvent(over: Partial<Event> = {}): Event {
  return {
    id: "e1",
    type: "session",
    title: "6월 정기세션",
    description: "",
    starts_at: "2026-07-17T10:00:00Z",
    ends_at: null,
    location: "산학협력관 101호",
    address: "",
    speaker: "",
    capacity: 30,
    created_by: null,
    created_at: "2026-07-01T00:00:00Z",
    ...over,
  };
}

describe("buildEventReminderMessage", () => {
  it("이벤트가 없으면 null", () => {
    expect(buildEventReminderMessage([], {})).toBeNull();
  });

  it("정원 있는 이벤트: 유형·제목·KST 시각·장소·신청 현황을 담는다", () => {
    const msg = buildEventReminderMessage([fakeEvent()], { e1: 12 });
    expect(msg).toContain("[이벤트 리마인더] 내일 시작하는 이벤트 1건");
    expect(msg).toContain("정기세션");
    expect(msg).toContain("6월 정기세션");
    expect(msg).toContain("오후 7:00");
    expect(msg).toContain("산학협력관 101호");
    expect(msg).toContain("신청 12/30명");
  });

  it("정원 없는 이벤트는 신청 수만 표시한다", () => {
    const msg = buildEventReminderMessage(
      [fakeEvent({ id: "e2", type: "mogakco", capacity: null, location: "" })],
      { e2: 5 },
    );
    expect(msg).toContain("모각코");
    expect(msg).toContain("신청 5명");
    expect(msg).not.toContain("·  ·");
  });
});
