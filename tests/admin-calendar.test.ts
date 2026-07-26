import { describe, expect, it } from "vitest";
import {
  diffDays,
  kstDayStartIso,
  monthGrid,
  nextDayKey,
  shiftMonth,
  shiftToDateKst,
  weekdayLabel,
} from "@/lib/calendar";

describe("monthGrid", () => {
  it("항상 6주(42칸)를 돌려줘 격자 높이가 달마다 흔들리지 않는다", () => {
    for (const month of ["2026-02", "2026-07", "2026-08", "2027-02"]) {
      expect(monthGrid(month)).toHaveLength(42);
    }
  });

  it("일요일에서 시작하고 해당 달 1일을 첫 주에 포함한다", () => {
    // 2026-07-01은 수요일 → 앞에 6/28(일)~6/30이 붙는다.
    const grid = monthGrid("2026-07");
    expect(grid[0]).toBe("2026-06-28");
    expect(grid[3]).toBe("2026-07-01");
  });

  it("달의 마지막 날까지 빠짐없이 담는다", () => {
    const grid = monthGrid("2026-08");
    expect(grid).toContain("2026-08-31");
    expect(grid.filter((d) => d.startsWith("2026-08"))).toHaveLength(31);
  });

  it("윤년 2월 29일도 담는다", () => {
    expect(monthGrid("2028-02")).toContain("2028-02-29");
  });

  it("칸이 하루씩 연속으로 이어진다", () => {
    const grid = monthGrid("2026-12");
    for (let i = 1; i < grid.length; i++) {
      expect(grid[i]).toBe(nextDayKey(grid[i - 1]));
    }
  });
});

describe("shiftMonth", () => {
  it("연도 경계를 넘어간다", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});

describe("kstDayStartIso", () => {
  it("KST 자정은 전날 15시 UTC다", () => {
    expect(kstDayStartIso("2026-07-26")).toBe("2026-07-25T15:00:00.000Z");
  });
});

describe("weekdayLabel", () => {
  it("격자 첫 칸은 항상 일요일이다", () => {
    for (const month of ["2026-02", "2026-07", "2027-11"]) {
      expect(weekdayLabel(monthGrid(month)[0])).toBe("일");
    }
  });

  it("2026-07-01은 수요일", () => {
    expect(weekdayLabel("2026-07-01")).toBe("수");
  });
});

describe("diffDays", () => {
  it("D-day 일수를 센다", () => {
    expect(diffDays("2026-07-26", "2026-07-26")).toBe(0);
    expect(diffDays("2026-07-26", "2026-07-28")).toBe(2);
    expect(diffDays("2026-07-26", "2026-08-04")).toBe(9);
  });

  it("지난 날짜는 음수", () => {
    expect(diffDays("2026-07-26", "2026-07-25")).toBe(-1);
  });
});

describe("shiftToDateKst", () => {
  it("KST 시각은 그대로 두고 날짜만 바꾼다", () => {
    // 2026-07-09T10:00Z = KST 19:00
    const moved = shiftToDateKst("2026-07-09T10:00:00.000Z", "2026-07-15");
    expect(moved).toBe("2026-07-15T10:00:00.000Z");
  });

  it("KST 기준 날짜가 UTC와 다른 밤 시간대도 시각을 지킨다", () => {
    // 2026-07-09T16:30Z = KST 7/10 01:30 → 7/20으로 옮기면 KST 7/20 01:30 = 7/19T16:30Z
    const moved = shiftToDateKst("2026-07-09T16:30:00.000Z", "2026-07-20");
    expect(moved).toBe("2026-07-19T16:30:00.000Z");
  });

  it("같은 날로 옮기면 값이 그대로다", () => {
    const iso = "2026-07-09T10:00:00.000Z";
    expect(shiftToDateKst(iso, "2026-07-09")).toBe(iso);
  });
});
