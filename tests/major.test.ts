import { describe, expect, it } from "vitest";
import { normalizeMajor } from "@/lib/major";

describe("전공 표기 정규화", () => {
  it("같은 전공의 별칭을 대표 전공명으로 보인다", () => {
    expect(normalizeMajor("컴퓨터공학과")).toBe("컴퓨터공학");
    expect(normalizeMajor("컴퓨터공학전공")).toBe("컴퓨터공학");
    expect(normalizeMajor("시각정보디자인")).toBe("시각디자인");
    expect(normalizeMajor("시각디자인")).toBe("시각디자인");
  });

  it("등록하지 않은 전공명은 그대로 둔다", () => {
    expect(normalizeMajor("스마트융합보안학과")).toBe("스마트융합보안학과");
  });
});
