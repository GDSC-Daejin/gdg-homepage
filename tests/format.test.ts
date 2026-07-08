import { describe, it, expect } from "vitest";
import { formatKst } from "@/lib/format";

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
