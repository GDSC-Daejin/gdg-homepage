import { describe, expect, it } from "vitest";
import { moveItem } from "@/app/admin/surveys/SurveyForm";

describe("moveItem", () => {
  it("항목을 아래로 옮긴다", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("항목을 위로 옮긴다", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("범위 밖이거나 제자리면 원본을 그대로 반환한다", () => {
    const list = ["a", "b", "c"];
    expect(moveItem(list, 1, 1)).toBe(list);
    expect(moveItem(list, 0, -1)).toBe(list);
    expect(moveItem(list, 0, 3)).toBe(list);
  });
});
