import { describe, expect, it } from "vitest";
import { computeAttendanceWarnings } from "@/lib/attendance-stats";
import type { AttendanceReads } from "@/lib/community/types";
import type { Profile } from "@/lib/types";

function fakeReads(over: Partial<AttendanceReads> = {}): AttendanceReads {
  return {
    activeMembers: async () => [],
    pastEventIds: async () => [],
    confirmedRegistrations: async () => [],
    attendances: async () => [],
    ...over,
  };
}

const member = (id: string, name: string) => ({ id, name } as Profile);

describe("computeAttendanceWarnings", () => {
  it("확정 대비 출석이 임계(50%) 미만인 회원을 표시한다", async () => {
    const reads = fakeReads({
      activeMembers: async () => [member("u1", "낮은출석")],
      pastEventIds: async () => ["e1", "e2", "e3", "e4"],
      confirmedRegistrations: async () =>
        ["e1", "e2", "e3", "e4"].map((event_id) => ({
          user_id: "u1",
          event_id,
        })),
      attendances: async () => [{ user_id: "u1", event_id: "e1" }],
    });

    expect(await computeAttendanceWarnings(reads)).toEqual([
      { userId: "u1", name: "낮은출석", rate: 0.25 },
    ]);
  });

  it("임계 이상이면 표시하지 않는다", async () => {
    const reads = fakeReads({
      activeMembers: async () => [member("u1", "높은출석")],
      pastEventIds: async () => ["e1", "e2"],
      confirmedRegistrations: async () => [
        { user_id: "u1", event_id: "e1" },
        { user_id: "u1", event_id: "e2" },
      ],
      attendances: async () => [
        { user_id: "u1", event_id: "e1" },
        { user_id: "u1", event_id: "e2" },
      ],
    });

    expect(await computeAttendanceWarnings(reads)).toEqual([]);
  });

  it("확정 신청이 0인 회원은 건너뛴다", async () => {
    const reads = fakeReads({
      activeMembers: async () => [member("u1", "신청없음")],
      pastEventIds: async () => ["e1"],
    });

    expect(await computeAttendanceWarnings(reads)).toEqual([]);
  });

  it("확정된 이벤트의 출석만 센다", async () => {
    const reads = fakeReads({
      activeMembers: async () => [member("u1", "A")],
      pastEventIds: async () => ["e1", "e2"],
      confirmedRegistrations: async () => [{ user_id: "u1", event_id: "e1" }],
      attendances: async () => [
        { user_id: "u1", event_id: "e1" },
        { user_id: "u1", event_id: "e2" },
      ],
    });

    expect(await computeAttendanceWarnings(reads)).toEqual([]);
  });
});
