import { describe, expect, it } from "vitest";
import { availabilityViews, draftAvailability } from "@/lib/meeting-poll-availability";
import { slotIso, type ParticipantView } from "@/lib/meeting-poll";

const slot = slotIso("2026-08-02", "18:00");

describe("meeting poll availability", () => {
  it("drag 영역을 칠해 공통 초안을 만든다", () => {
    expect(
      draftAvailability(new Set(), { mode: "paint", anchor: { dateIndex: 0, timeIndex: 0 }, cursor: { dateIndex: 0, timeIndex: 0 } }, ["2026-08-02"], ["18:00"]),
    ).toEqual(new Set([slot]));
  });

  it("선택한 Participant만 초안과 응답 상태로 바꾼다", () => {
    const view = { id: "participant", name: "이름", initial: "이", color: "blue", avatarPath: null, responded: false, slots: new Set() } satisfies ParticipantView;
    expect(availabilityViews([view], "participant", new Set([slot]), true)[0]).toMatchObject({ responded: true, slots: new Set([slot]) });
  });
});
