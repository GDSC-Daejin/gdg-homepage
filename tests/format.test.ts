import { describe, it, expect, vi } from "vitest";
import {
  formatKst,
  formatKstRange,
  formatMonthLabel,
  formatRelativeKst,
  monthKst,
} from "@/lib/format";

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

describe("formatRelativeKst", () => {
  it("24시간 이내면 상대 시간을 표시한다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-19T03:30:00.000Z"));
    expect(formatRelativeKst("2026-07-19T03:00:00.000Z")).toBe("30분 전");
    vi.useRealTimers();
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

describe("formatKstRange", () => {
  it("종료가 없으면 시작 일시만 반환한다", () => {
    const s = "2026-07-23T03:00:00.000Z"; // KST 12:00
    expect(formatKstRange(s, null)).toBe("2026. 7. 23. 오후 12:00");
  });

  it("같은 날이면 시작 일시 + 종료 시각만 붙인다", () => {
    const s = "2026-07-23T03:00:00.000Z"; // KST 12:00
    const e = "2026-07-23T07:00:00.000Z"; // KST 16:00
    expect(formatKstRange(s, e)).toBe("2026. 7. 23. 오후 12:00 ~ 오후 4:00");
  });

  it("다른 날이면 시작·종료 전체를 표시한다", () => {
    const s = "2026-07-23T15:00:00.000Z"; // KST 07-24 00:00
    const e = "2026-07-24T03:00:00.000Z"; // KST 07-24 12:00
    const out = formatKstRange(s, e);
    expect(out).toContain("~");
    expect(out).toContain("7. 24.");
  });
});
