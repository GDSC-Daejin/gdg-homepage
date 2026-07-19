"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { interviewQuestionSchema } from "@/lib/schemas";
import { toKoreanError } from "@/lib/errors";
import { isDemoMode } from "@/lib/demo";
import type { ActionResult, Position } from "@/lib/types";

export async function createInterviewQuestion(
  position: Position | null,
  body: string,
): Promise<ActionResult> {
  const profile = await requireAdmin();
  if (await isDemoMode()) return {};

  const parsed = interviewQuestionSchema.safeParse({ position, body });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("interview_questions").insert({
    position: parsed.data.position,
    body: parsed.data.body,
    created_by: profile.id,
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/interview-questions");
  return {};
}

export async function updateInterviewQuestion(
  id: string,
  body: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  if (!body.trim()) return { error: "질문을 입력해주세요" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("interview_questions")
    .update({ body: body.trim(), updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/interview-questions");
  return {};
}

export async function deleteInterviewQuestion(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { error } = await supabase
    .from("interview_questions")
    .delete()
    .eq("id", id);

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/interview-questions");
  return {};
}
