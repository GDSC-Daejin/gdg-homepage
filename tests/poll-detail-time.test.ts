import { describe, expect, it, vi } from "vitest";
import {
  addMinutes,
  adjustmentOptions,
  endOf,
  nearestDuration,
  pastDue,
} from "@/app/schedule/[id]/poll-detail-time";

describe("poll detail time helpers", () => {
  it("추천 구간의 끝 시각을 자정까지만 계산한다", () => {
    expect(addMinutes("23:30", 60)).toBe("24:00");
  });

  it("추천 구간에 맞는 가장 짧은 확정 시간을 고른다", () => {
    expect(nearestDuration(75)).toBe(90);
  });

  it("마감 시각 이후만 응답을 잠근다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-02T12:00:00.000Z"));
    expect(pastDue("2026-08-02T11:59:59.000Z")).toBe(true);
    expect(pastDue("2026-08-02T12:00:01.000Z")).toBe(false);
    vi.useRealTimers();
  });

  it("추천 구간 마지막 칸의 ISO를 고른다", () => {
    expect(
      endOf(
        { dateIndex: 0, to: 1 },
        ["18:00", "18:30"],
        ["2026-08-02"],
      ),
    ).toBe("2026-08-02T09:30:00.000Z");
  });

  it("추천 시간 안에서 30분 단위로 조정할 시간을 만든다", () => {
    expect(
      adjustmentOptions(
        { dateIndex: 0, from: 0, durationMin: 60 },
        ["10:00", "10:30"],
        ["2026-08-05"],
      ),
    ).toEqual([
      { startIso: "2026-08-05T01:00:00.000Z", label: "오전 10:00 ~ 오전 10:30" },
      { startIso: "2026-08-05T01:30:00.000Z", label: "오전 10:30 ~ 오전 11:00" },
    ]);
  });
});
