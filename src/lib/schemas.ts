import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요"),
  student_no: z.string(),
  major: z.string(),
  phone: z.string(),
  interests: z.array(z.string()),
});

export const eventSchema = z.object({
  type: z.enum(["session", "study", "devfest"]),
  title: z.string().min(1, "제목을 입력해주세요"),
  description: z.string(),
  starts_at: z.string().min(1, "일시를 입력해주세요"),
  location: z.string(),
  speaker: z.string(),
  capacity: z.coerce.number().int().positive().nullable(),
});

export const applicationSchema = z.object({
  season: z.string().min(1),
  answers: z.record(z.string(), z.string()),
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

export const surveyResponseSchema = z.object({
  answers: z.record(z.string(), z.union([z.number(), z.string()])),
});

export const inquirySchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요"),
  body: z.string(),
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
  memo: z.string(),
});

export const sponsorSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요"),
  amount: z.coerce.number().int().positive("금액은 양수여야 해요"),
  season: z.string(),
  note: z.string(),
});
