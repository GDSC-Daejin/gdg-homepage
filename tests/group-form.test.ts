import { describe, expect, it } from "vitest";
import { parseGroupForm } from "@/lib/group-form";

const fd = (values: Record<string, string>) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
};

describe("parseGroupForm", () => {
  it("정상 입력을 파싱한다", () => {
    const { data, error } = parseGroupForm(
      fd({ type: "study", title: " TS 스터디 ", description: "설명", season: "2026-2", status: "recruiting", capacity: "6" }),
    );
    expect(error).toBeUndefined();
    expect(data.title).toBe("TS 스터디");
    expect(data.capacity).toBe(6);
  });

  it("제목이 비면 에러", () => {
    const { error } = parseGroupForm(fd({ type: "study", title: "  ", season: "2026-2", status: "recruiting" }));
    expect(error).toBe("제목을 입력해주세요");
  });

  it("잘못된 type은 에러", () => {
    const { error } = parseGroupForm(fd({ type: "club", title: "x", season: "2026-2", status: "recruiting" }));
    expect(error).toBe("종류가 올바르지 않습니다");
  });

  it("빈 capacity는 null", () => {
    const { data } = parseGroupForm(fd({ type: "project", title: "x", season: "2026-2", status: "active", capacity: "" }));
    expect(data.capacity).toBeNull();
  });

  it("capacity가 0 이하면 에러", () => {
    const { error } = parseGroupForm(fd({ type: "project", title: "x", season: "2026-2", status: "active", capacity: "0" }));
    expect(error).toBe("정원은 1 이상이어야 합니다");
  });
});
