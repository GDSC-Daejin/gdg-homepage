import { describe, it, expect } from "vitest";
import { isRecruitingOpen } from "@/lib/recruiting";
import type { RecruitingSettings } from "@/lib/types";

// 오늘(KST)에서 days만큼 이동한 "YYYY-MM-DD"
const shift = (days: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + days * 86_400_000));

const base: RecruitingSettings = {
  season: "2026-2",
  is_open: true,
  open_positions: ["frontend"],
  apply_start: null,
  apply_end: null,
};

describe("isRecruitingOpen", () => {
  it("수동 스위치가 꺼져 있으면 닫힘", () => {
    expect(isRecruitingOpen({ ...base, is_open: false })).toBe(false);
  });

  it("켜져 있고 기간이 없으면 열림", () => {
    expect(isRecruitingOpen(base)).toBe(true);
  });

  it("종료일이 지나면 자동으로 닫힘", () => {
    expect(isRecruitingOpen({ ...base, apply_end: shift(-1) })).toBe(false);
  });

  it("시작일 전이면 닫힘", () => {
    expect(isRecruitingOpen({ ...base, apply_start: shift(1) })).toBe(false);
  });

  it("기간 안이면 열림", () => {
    expect(
      isRecruitingOpen({ ...base, apply_start: shift(-1), apply_end: shift(1) }),
    ).toBe(true);
  });
});
