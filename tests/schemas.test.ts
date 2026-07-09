import { describe, it, expect } from "vitest";
import {
  profileSchema,
  attendCodeSchema,
  noticeSchema,
  surveySchema,
  surveyResponseSchema,
  inquirySchema,
  pointGrantSchema,
  budgetSchema,
} from "@/lib/schemas";

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

describe("noticeSchema", () => {
  it("빈 제목은 reject한다", () => {
    const result = noticeSchema.safeParse({ title: "", body: "내용" });
    expect(result.success).toBe(false);
  });

  it("정상 입력은 통과한다", () => {
    const result = noticeSchema.safeParse({ title: "공지", body: "내용" });
    expect(result.success).toBe(true);
  });
});

describe("surveySchema", () => {
  it("질문이 0개면 reject한다", () => {
    const result = surveySchema.safeParse({ title: "설문", questions: [] });
    expect(result.success).toBe(false);
  });

  it("질문이 1개 이상이면 통과한다", () => {
    const result = surveySchema.safeParse({
      title: "설문",
      questions: [{ id: "q1", type: "rating", label: "만족도" }],
    });
    expect(result.success).toBe(true);
  });

  it("질문 type이 rating/text가 아니면 reject한다", () => {
    const result = surveySchema.safeParse({
      title: "설문",
      questions: [{ id: "q1", type: "invalid", label: "만족도" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("surveyResponseSchema", () => {
  it("answers가 number/string 혼합이어도 통과한다", () => {
    const result = surveyResponseSchema.safeParse({
      answers: { q1: 5, q2: "좋아요" },
    });
    expect(result.success).toBe(true);
  });
});

describe("inquirySchema", () => {
  it("빈 제목은 reject한다", () => {
    const result = inquirySchema.safeParse({ title: "", body: "내용" });
    expect(result.success).toBe(false);
  });

  it("정상 입력은 통과한다", () => {
    const result = inquirySchema.safeParse({ title: "문의", body: "내용" });
    expect(result.success).toBe(true);
  });
});

describe("pointGrantSchema", () => {
  it("amount가 0이면 reject한다", () => {
    const result = pointGrantSchema.safeParse({ amount: 0, reason: "사유" });
    expect(result.success).toBe(false);
  });

  it("reason이 빈 문자열이면 reject한다", () => {
    const result = pointGrantSchema.safeParse({ amount: 10, reason: "" });
    expect(result.success).toBe(false);
  });

  it("정상 입력은 통과한다", () => {
    const result = pointGrantSchema.safeParse({ amount: -10, reason: "벌점" });
    expect(result.success).toBe(true);
  });
});

describe("budgetSchema", () => {
  it("amount가 0 이하면 reject한다", () => {
    const result = budgetSchema.safeParse({
      entry_date: "2026-07-09",
      type: "income",
      category: "후원",
      amount: 0,
    });
    expect(result.success).toBe(false);
  });

  it("type이 income/expense가 아니면 reject한다", () => {
    const result = budgetSchema.safeParse({
      entry_date: "2026-07-09",
      type: "invalid",
      category: "후원",
      amount: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("정상 입력은 통과한다", () => {
    const result = budgetSchema.safeParse({
      entry_date: "2026-07-09",
      type: "expense",
      category: "다과",
      amount: 15000,
    });
    expect(result.success).toBe(true);
  });
});
