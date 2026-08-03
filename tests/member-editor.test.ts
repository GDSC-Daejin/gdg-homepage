import { describe, expect, it } from "vitest";
import { toMemberProfileInput } from "@/app/admin/members/member-editor";

describe("toMemberProfileInput", () => {
  it("관심 분야의 공백과 빈 값을 정리한다", () => {
    expect(toMemberProfileInput({
      name: "민지",
      nickname: "minji",
      studentNo: "20260001",
      major: "컴퓨터공학",
      phone: "010-0000-0000",
      interests: " frontend, , backend , ",
    })).toMatchObject({
      student_no: "20260001",
      interests: ["frontend", "backend"],
    });
  });
});
