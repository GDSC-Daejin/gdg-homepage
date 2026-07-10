import { describe, it, expect } from "vitest";
import { formatKst, formatMonthLabel, monthKst } from "@/lib/format";

describe("formatKst", () => {
  it("UTC 시각을 KST(UTC+9)로 옮겨 표시한다", () => {
    const result = formatKst("2026-07-09T03:00:00.000Z");
    expect(result).toContain("12:00");
  });

  it("자정을 넘어가는 UTC 시각도 KST 날짜로 옮긴다 (다음날로 이동)", () => {
    const result = formatKst("2026-07-09T20:15:00.000Z");
    expect(result).toContain("10");
    expect(result).toContain("5:15");
  });
});

describe("monthKst", () => {
  it("KST 기준 YYYY-MM을 돌려준다", () => {
    expect(monthKst("2026-07-09T03:00:00.000Z")).toBe("2026-07");
  });

  it("월 경계의 UTC 시각은 KST 기준 다음 달로 넘어간다", () => {
    expect(monthKst("2026-06-30T16:00:00.000Z")).toBe("2026-07");
  });
});

describe("formatMonthLabel", () => {
  it("YYYY-MM을 한국어 라벨로 바꾼다", () => {
    expect(formatMonthLabel("2026-07")).toBe("2026년 7월");
  });
});
