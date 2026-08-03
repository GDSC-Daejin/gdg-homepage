import { describe, expect, it } from "vitest";
import { recentMonths } from "@/app/admin/dashboard-data";

describe("recentMonths", () => {
  it("KST 기준 현재 월까지 여섯 달을 순서대로 만든다", () => {
    expect(recentMonths(new Date("2026-08-02T12:00:00.000Z")).map((month) => month.key)).toEqual([
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
  });
});
