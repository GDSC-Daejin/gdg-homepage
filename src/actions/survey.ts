"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { surveySchema, surveyResponseSchema } from "@/lib/schemas";
import { toKoreanError } from "@/lib/errors";
import type { ActionResult, Survey } from "@/lib/types";

function parseSurveyForm(formData: FormData) {
  let questions: unknown = [];
  try {
    questions = JSON.parse(String(formData.get("questions") ?? "[]"));
  } catch {
    questions = [];
  }
  return surveySchema.safeParse({
    title: formData.get("title"),
    questions,
  });
}

export async function createSurvey(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseSurveyForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const eventIdRaw = formData.get("event_id");
  const event_id = typeof eventIdRaw === "string" && eventIdRaw ? eventIdRaw : null;

  const supabase = await createClient();
  const { error } = await supabase.from("surveys").insert({
    title: parsed.data.title,
    questions: parsed.data.questions,
    event_id,
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/surveys");
  return {};
}

export async function toggleSurveyOpen(
  id: string,
  isOpen: boolean,
): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase
    .from("surveys")
    .update({ is_open: isOpen })
    .eq("id", id);

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/surveys");
  revalidatePath("/surveys");
  return {};
}

export async function deleteSurvey(id: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("surveys").delete().eq("id", id);

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/surveys");
  revalidatePath("/surveys");
  return {};
}

export async function submitSurveyResponse(
  surveyId: string,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await requireProfile();

  const supabase = await createClient();
  const { data: survey } = await supabase
    .from("surveys")
    .select("*")
    .eq("id", surveyId)
    .single();

  if (!survey) return { error: "설문을 찾을 수 없어요" };
  const s = survey as Survey;

  const answers: Record<string, number | string> = {};
  for (const q of s.questions) {
    const raw = formData.get(`answer_${q.id}`);
    if (raw === null || raw === "") continue;
    answers[q.id] = q.type === "rating" ? Number(raw) : String(raw);
  }

  const parsed = surveyResponseSchema.safeParse({ answers });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const { error } = await supabase.from("survey_responses").insert({
    survey_id: surveyId,
    user_id: profile.id,
    answers: parsed.data.answers,
  });

  if (error) {
    if (error.code === "23505") return { error: "이미 응답한 설문이에요" };
    return { error: toKoreanError(error) };
  }

  revalidatePath(`/surveys/${surveyId}`);
  revalidatePath("/surveys");
  return {};
}
