import { describe, expect, it } from "vitest";
import { sumPointsInMonth } from "@/lib/points";

const log = (amount: number, created_at: string) => ({ amount, created_at });

describe("sumPointsInMonth", () => {
  it("해당 월 로그만 합산한다", () => {
    const logs = [
      log(10, "2026-07-10T03:00:00Z"),
      log(20, "2026-07-15T03:00:00Z"),
      log(99, "2026-06-15T03:00:00Z"),
    ];
    expect(sumPointsInMonth(logs, "2026-07")).toBe(30);
  });

  it("KST 기준으로 월을 판정한다 (UTC 6/30 15:30 = KST 7/1 00:30)", () => {
    expect(sumPointsInMonth([log(10, "2026-06-30T15:30:00Z")], "2026-07")).toBe(10);
    expect(sumPointsInMonth([log(10, "2026-06-30T15:30:00Z")], "2026-06")).toBe(0);
  });

  it("빈 목록은 0", () => {
    expect(sumPointsInMonth([], "2026-07")).toBe(0);
  });
});
