import { describe, it, expect } from "vitest";
import {
  profileSchema,
  eventSchema,
  applicationSchema,
  attendCodeSchema,
  noticeSchema,
  interviewQuestionSchema,
  surveySchema,
  surveyResponseSchema,
  inquirySchema,
  postSchema,
  commentSchema,
  pointGrantSchema,
  budgetSchema,
  recruitingSettingsSchema,
  interviewSlotsSchema,
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
      nickname: "Gildong",
      student_no: "202012345",
      major: "컴퓨터공학과",
      phone: "010-1234-5678",
      interests: ["Android", "Web"],
      position: "frontend",
    });
    expect(result.success).toBe(true);
  });

  it("포지션 미선택은 reject한다", () => {
    const result = profileSchema.safeParse({
      name: "홍길동",
      student_no: "202012345",
      major: "컴퓨터공학과",
      phone: "010-1234-5678",
      interests: [],
    });
    expect(result.success).toBe(false);
  });

  it("학번·전공·전화번호가 비면 reject한다", () => {
    for (const empty of ["student_no", "major", "phone"] as const) {
      const result = profileSchema.safeParse({
        name: "홍길동",
        student_no: "202012345",
        major: "컴퓨터공학과",
        phone: "010-1234-5678",
        interests: [],
        position: "frontend",
        [empty]: "",
      });
      expect(result.success).toBe(false);
    }
  });
});

describe("applicationSchema", () => {
  const valid = {
    applicant_name: "홍길동",
    student_no: "20241001",
    major: "컴퓨터공학과",
    phone: "010-1234-5678",
    email: "hong@dju.ac.kr",
    season: "2026-2",
    answers: { intro: "a", motivation: "b", interest: "c" },
    position: "frontend",
  };

  it("정상 입력은 통과한다", () => {
    expect(applicationSchema.safeParse(valid).success).toBe(true);
  });

  it("이메일 형식이 틀리면 reject한다", () => {
    expect(applicationSchema.safeParse({ ...valid, email: "nope" }).success).toBe(
      false,
    );
  });

  it("이름이 비면 reject한다", () => {
    expect(
      applicationSchema.safeParse({ ...valid, applicant_name: "" }).success,
    ).toBe(false);
  });

  it("지원 파트가 없으면 reject한다", () => {
    const { position: _position, ...withoutPosition } = valid;
    expect(applicationSchema.safeParse(withoutPosition).success).toBe(false);
  });

  it("지원 파트가 잘못된 값이면 reject한다", () => {
    expect(
      applicationSchema.safeParse({ ...valid, position: "planning" }).success,
    ).toBe(false);
  });
});

describe("recruitingSettingsSchema", () => {
  it("모집 파트가 0개면 reject한다", () => {
    const result = recruitingSettingsSchema.safeParse({
      season: "2026-2",
      is_open: true,
      open_positions: [],
    });
    expect(result.success).toBe(false);
  });

  it("정상 입력은 통과한다", () => {
    const result = recruitingSettingsSchema.safeParse({
      season: "2026-2",
      is_open: true,
      open_positions: ["frontend", "backend"],
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
    const result = inquirySchema.safeParse({
      category: "general",
      title: "",
      body: "내용",
    });
    expect(result.success).toBe(false);
  });

  it("빈 내용은 reject한다", () => {
    const result = inquirySchema.safeParse({
      category: "general",
      title: "문의",
      body: "",
    });
    expect(result.success).toBe(false);
  });

  it("정상 입력은 통과한다", () => {
    const result = inquirySchema.safeParse({
      category: "general",
      title: "문의",
      body: "내용",
    });
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

describe("eventSchema", () => {
  const base = {
    type: "session" as const,
    title: "정기세션",
    description: "",
    starts_at: "2026-07-23T03:00:00.000Z",
    place_id: null,
    speaker: "",
    capacity: null,
  };

  it("ends_at 없이 통과한다", () => {
    expect(eventSchema.safeParse(base).success).toBe(true);
  });

  it("ends_at이 starts_at보다 뒤면 통과한다", () => {
    const r = eventSchema.safeParse({ ...base, ends_at: "2026-07-23T07:00:00.000Z" });
    expect(r.success).toBe(true);
  });

  it("ends_at이 starts_at보다 앞이면 reject한다", () => {
    const r = eventSchema.safeParse({ ...base, ends_at: "2026-07-23T01:00:00.000Z" });
    expect(r.success).toBe(false);
  });

  it("ends_at이 null이면 통과한다", () => {
    expect(eventSchema.safeParse({ ...base, ends_at: null }).success).toBe(true);
  });
});

describe("interviewSlotsSchema", () => {
  const valid = {
    starts_at: [new Date(Date.now() + 86_400_000).toISOString()],
    duration_min: 30,
  };

  it("유효한 슬롯 입력은 통과한다", () => {
    expect(interviewSlotsSchema.safeParse(valid).success).toBe(true);
  });

  it("빈 배열과 0 이하 소요 시간은 거부한다", () => {
    expect(
      interviewSlotsSchema.safeParse({ ...valid, starts_at: [] }).success,
    ).toBe(false);
    expect(
      interviewSlotsSchema.safeParse({ ...valid, duration_min: 0 }).success,
    ).toBe(false);
  });

  it("과거 시각과 잘못된 날짜 형식은 거부한다", () => {
    expect(
      interviewSlotsSchema.safeParse({
        ...valid,
        starts_at: ["2000-01-01T00:00:00+09:00"],
      }).success,
    ).toBe(false);
    expect(
      interviewSlotsSchema.safeParse({ ...valid, starts_at: ["not-a-date"] })
        .success,
    ).toBe(false);
  });
});

describe("postSchema", () => {
  it("free/qna 외 board는 reject한다", () => {
    const result = postSchema.safeParse({
      board: "notice",
      title: "제목",
      body: "내용",
    });
    expect(result.success).toBe(false);
  });

  it("event_id 없이 통과한다", () => {
    const result = postSchema.safeParse({
      board: "free",
      title: "제목",
      body: "내용",
    });
    expect(result.success).toBe(true);
  });

  it("빈 제목은 reject한다", () => {
    const result = postSchema.safeParse({
      board: "qna",
      title: "",
      body: "내용",
    });
    expect(result.success).toBe(false);
  });
});

describe("commentSchema", () => {
  it("빈 내용은 reject한다", () => {
    expect(commentSchema.safeParse({ body: "" }).success).toBe(false);
  });

  it("내용이 있으면 통과한다", () => {
    expect(commentSchema.safeParse({ body: "댓글" }).success).toBe(true);
  });
});

describe("interviewQuestionSchema", () => {
  it("빈 body는 reject한다", () => {
    const result = interviewQuestionSchema.safeParse({ position: "frontend", body: "" });
    expect(result.success).toBe(false);
  });

  it("position null(공통)을 허용한다", () => {
    const result = interviewQuestionSchema.safeParse({ position: null, body: "자기소개 해주세요" });
    expect(result.success).toBe(true);
  });

  it("정상 포지션 입력을 통과시킨다", () => {
    const result = interviewQuestionSchema.safeParse({ position: "backend", body: "트랜잭션이란?" });
    expect(result.success).toBe(true);
  });

  it("잘못된 position은 reject한다", () => {
    const result = interviewQuestionSchema.safeParse({ position: "pm", body: "질문" });
    expect(result.success).toBe(false);
  });
});
