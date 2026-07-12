import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요"),
  student_no: z.string().min(1, "학번을 입력해주세요"),
  major: z.string().min(1, "전공을 입력해주세요"),
  phone: z.string().min(1, "전화번호를 입력해주세요"),
  interests: z.array(z.string()),
  position: z.enum(["frontend", "backend", "designer"], {
    message: "포지션을 선택해주세요",
  }),
});

export const eventSchema = z
  .object({
    type: z.enum(["session", "study", "mogakco", "party"]),
    title: z.string().min(1, "제목을 입력해주세요"),
    description: z.string(),
    starts_at: z.string().min(1, "일시를 입력해주세요"),
    ends_at: z.string().nullable().optional(),
    location: z.string(),
    address: z.string(),
    speaker: z.string(),
    capacity: z.coerce.number().int().positive().nullable(),
  })
  .refine(
    (v) => !v.ends_at || new Date(v.ends_at) > new Date(v.starts_at),
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
  position: z.enum(["frontend", "backend", "designer"], {
    message: "지원 파트를 선택해주세요",
  }),
});

export const recruitingSettingsSchema = z.object({
  season: z.string().min(1, "시즌명을 입력해주세요"),
  is_open: z.boolean(),
  open_positions: z
    .array(z.enum(["frontend", "backend", "designer"]))
    .min(1, "모집 파트를 1개 이상 선택해주세요"),
});

export const attendCodeSchema = z
  .string()
  .regex(/^[A-Za-z0-9]{6}$/, "출석 코드는 영숫자 6자예요");

export const noticeSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요"),
  body: z.string(),
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
