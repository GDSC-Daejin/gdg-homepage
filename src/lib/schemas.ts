import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요"),
  nickname: z.string().min(1, "영어 닉네임을 입력해주세요"),
  student_no: z.string().min(1, "학번을 입력해주세요"),
  major: z.string().min(1, "전공을 입력해주세요"),
  phone: z.string().min(1, "전화번호를 입력해주세요"),
  interests: z.array(z.string()),
  position: z.enum(["frontend", "backend", "designer", "beginner"], {
    message: "포지션을 선택해주세요",
  }),
  academic_status: z
    .enum(["enrolled", "leave", "graduated", "completed"])
    .nullable()
    .optional(),
  featured_pokemon_id: z.string().uuid("대표 포켓몬 값이 올바르지 않아요").nullable().optional(),
});

export const eventSchema = z
  .object({
    type: z.enum(["session", "study", "mogakco", "party"]),
    title: z.string().min(1, "제목을 입력해주세요"),
    description: z.string(),
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    start_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    end_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    starts_at: z.string().nullable().optional(),
    ends_at: z.string().nullable().optional(),
    place_id: z.string().uuid().nullable(),
    speaker: z.string(),
    capacity: z.coerce.number().int().positive().nullable(),
  })
  .refine(
    (v) => !v.ends_at || !v.starts_at || new Date(v.ends_at) > new Date(v.starts_at),
    { message: "종료 일시는 시작 일시보다 뒤여야 해요", path: ["ends_at"] },
  );

export const applicationSchema = z.object({
  applicant_name: z.string().min(1, "이름을 입력해주세요"),
  student_no: z.string().min(1, "학번을 입력해주세요"),
  major: z.string().min(1, "전공을 입력해주세요"),
  phone: z.string().min(1, "전화번호를 입력해주세요"),
  email: z.email("이메일 형식이 올바르지 않아요"),
  season: z.string().min(1),
  answers: z.record(z.string(), z.string()),
  position: z.enum(["frontend", "backend", "designer", "beginner"], {
    message: "지원 파트를 선택해주세요",
  }),
});

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않아요")
  .nullish();

export const recruitingSettingsSchema = z
  .object({
    season: z.string().min(1, "시즌명을 입력해주세요"),
    is_open: z.boolean(),
    open_positions: z
      .array(z.enum(["frontend", "backend", "designer", "beginner"]))
      .min(1, "모집 파트를 1개 이상 선택해주세요"),
    apply_start: dateStr,
    apply_end: dateStr,
  })
  .refine(
    (v) => !v.apply_start || !v.apply_end || v.apply_end >= v.apply_start,
    { message: "종료일은 시작일보다 뒤여야 해요", path: ["apply_end"] },
  );

export const attendCodeSchema = z
  .string()
  .regex(/^[A-Z0-9]{6}$/, "출석 코드는 영숫자 6자예요");

export const noticeSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요"),
  body: z.string(),
});

export const interviewQuestionSchema = z.object({
  position: z.enum(["frontend", "backend", "designer", "beginner"]).nullable(),
  body: z.string().min(1, "질문을 입력해주세요"),
});

export const surveyQuestionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["rating", "text"]),
  label: z.string().min(1),
});

export const surveySchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요"),
  questions: z
    .array(surveyQuestionSchema)
    .min(1, "질문을 1개 이상 입력해주세요"),
});

export const surveyPresetSchema = z.object({
  name: z.string().min(1, "프리셋 이름을 입력해주세요"),
  questions: z
    .array(surveyQuestionSchema)
    .min(1, "질문을 1개 이상 추가해주세요"),
});

export const surveyResponseSchema = z.object({
  answers: z.record(z.string(), z.union([z.number(), z.string()])),
});

export const postSchema = z.object({
  board: z.enum(["free", "qna"]),
  title: z.string().min(1, "제목을 입력해주세요"),
  body: z.string().min(1, "내용을 입력해주세요"),
  event_id: z.string().nullable().optional(),
});

export const commentSchema = z.object({
  body: z.string().min(1, "내용을 입력해주세요"),
});

export const inquirySchema = z.object({
  category: z.enum(["general", "suggestion", "bug", "activity", "etc"]),
  title: z.string().min(1, "제목을 입력해주세요"),
  body: z.string().min(1, "내용을 입력해주세요"),
});

export const pointGrantSchema = z.object({
  amount: z.coerce
    .number()
    .int()
    .refine((v) => v !== 0, "포인트는 0이 될 수 없어요"),
  reason: z.string().min(1, "사유를 입력해주세요"),
});

export const budgetSchema = z.object({
  entry_date: z.string().min(1, "날짜를 입력해주세요"),
  type: z.enum(["income", "expense"]),
  category: z.string().min(1, "분류를 입력해주세요"),
  amount: z.coerce.number().int().positive("금액은 양수여야 해요"),
  memo: z.string().default(""),
});

export const interviewSlotsSchema = z.object({
  starts_at: z
    .array(
      z
        .string()
        .refine((value) => !Number.isNaN(Date.parse(value)), "날짜 형식이 올바르지 않아요")
        .refine((value) => Date.parse(value) > Date.now(), "과거 시각은 선택할 수 없어요"),
    )
    .min(1, "슬롯을 하나 이상 추가해주세요"),
  duration_min: z.number().int().positive("소요 시간이 올바르지 않아요"),
});
