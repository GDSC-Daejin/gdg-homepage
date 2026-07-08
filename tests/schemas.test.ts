import { describe, it, expect } from "vitest";
import { profileSchema, attendCodeSchema } from "@/lib/schemas";

describe("profileSchema", () => {
  it("빈 이름은 reject한다", () => {
    const result = profileSchema.safeParse({
      name: "",
      student_no: "",
      major: "",
      phone: "",
      interests: [],
    });
    expect(result.success).toBe(false);
  });

  it("정상 입력은 통과한다", () => {
    const result = profileSchema.safeParse({
      name: "홍길동",
      student_no: "202012345",
      major: "컴퓨터공학과",
      phone: "010-1234-5678",
      interests: ["Android", "Web"],
    });
    expect(result.success).toBe(true);
  });
});

describe("attendCodeSchema", () => {
  it("6자 영숫자가 아니면 reject한다", () => {
    expect(attendCodeSchema.safeParse("abc").success).toBe(false);
    expect(attendCodeSchema.safeParse("!!!!!!").success).toBe(false);
    expect(attendCodeSchema.safeParse("1234567").success).toBe(false);
  });

  it("6자 영숫자는 통과한다", () => {
    expect(attendCodeSchema.safeParse("AB12CD").success).toBe(true);
  });
});
