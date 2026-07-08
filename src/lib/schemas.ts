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
