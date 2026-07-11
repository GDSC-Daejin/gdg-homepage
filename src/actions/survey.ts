"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  surveySchema,
  surveyResponseSchema,
  surveyPresetSchema,
} from "@/lib/schemas";
import { toKoreanError } from "@/lib/errors";
import { isDemoMode } from "@/lib/demo";
import type { ActionResult, Survey, SurveyPreset } from "@/lib/types";

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
  if (await isDemoMode()) return {};

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

export async function createSurveyPreset(
  formData: FormData,
): Promise<{ error?: string; preset?: SurveyPreset }> {
  const profile = await requireAdmin();
  if (await isDemoMode()) return { error: "둘러보기 모드에서는 저장할 수 없어요" };

  let questions: unknown = [];
  try {
    questions = JSON.parse(String(formData.get("questions") ?? "[]"));
  } catch {
    questions = [];
  }
  const parsed = surveyPresetSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    questions,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("survey_presets")
    .insert({
      name: parsed.data.name,
      questions: parsed.data.questions,
      created_by: profile.id,
    })
    .select("*")
    .single();

  if (error) return { error: toKoreanError(error) };
  return { preset: data as SurveyPreset };
}

export async function deleteSurveyPreset(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { error } = await supabase.from("survey_presets").delete().eq("id", id);
  if (error) return { error: toKoreanError(error) };
  return {};
}

export async function toggleSurveyOpen(
  id: string,
  isOpen: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

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
  if (await isDemoMode()) return {};

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

  const { data: existing } = await supabase
    .from("survey_responses")
    .select("id")
    .eq("survey_id", surveyId)
    .eq("user_id", profile.id)
    .maybeSingle<{ id: string }>();

  const { error } = existing
    ? await supabase
        .from("survey_responses")
        .update({ answers: parsed.data.answers })
        .eq("id", existing.id)
    : await supabase.from("survey_responses").insert({
        survey_id: surveyId,
        user_id: profile.id,
        answers: parsed.data.answers,
      });

  if (error) return { error: toKoreanError(error) };

  revalidatePath(`/surveys/${surveyId}`);
  revalidatePath("/surveys");
  return {};
}
