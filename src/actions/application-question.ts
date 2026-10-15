"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { applicationQuestionPresetSchema, applicationQuestionSchema } from "@/lib/schemas";
import { toKoreanError } from "@/lib/errors";
import { isDemoMode } from "@/lib/demo";
import type { ActionResult, ApplicationQuestionPreset, Position } from "@/lib/types";

function refresh() {
  revalidatePath("/admin/application-questions");
  revalidatePath("/apply");
}

export async function createApplicationQuestion(position: Position, label: string): Promise<ActionResult> {
  const profile = await requireAdmin();
  if (await isDemoMode()) return {};
  const parsed = applicationQuestionSchema.safeParse({ position, label });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  const supabase = await createClient();
  const { data: last } = await supabase.from("application_questions").select("sort_order").eq("position", position).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("application_questions").insert({ position: parsed.data.position, label: parsed.data.label, sort_order: (last?.sort_order ?? -1) + 1, created_by: profile.id });
  if (error) return { error: toKoreanError(error) };
  refresh();
  return {};
}

export async function updateApplicationQuestion(id: string, label: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  const parsed = applicationQuestionSchema.shape.label.safeParse(label);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "질문을 확인해주세요" };
  const { error } = await (await createClient()).from("application_questions").update({ label: parsed.data, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: toKoreanError(error) };
  refresh();
  return {};
}

export async function deleteApplicationQuestion(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  const { error } = await (await createClient()).from("application_questions").delete().eq("id", id);
  if (error) return { error: toKoreanError(error) };
  refresh();
  return {};
}

export async function saveApplicationQuestionPreset(position: Position, name: string, questions: string[]): Promise<{ error?: string; preset?: ApplicationQuestionPreset }> {
  const profile = await requireAdmin();
  if (await isDemoMode()) return {};
  const parsed = applicationQuestionPresetSchema.safeParse({ position, name, questions });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  const { data, error } = await (await createClient()).from("application_question_presets").insert({ position: parsed.data.position, name: parsed.data.name, questions: parsed.data.questions, created_by: profile.id }).select("*").single();
  if (error) return { error: toKoreanError(error) };
  refresh();
  return { preset: data as ApplicationQuestionPreset };
}

export async function applyApplicationQuestionPreset(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  const { error } = await (await createClient()).rpc("admin_apply_application_question_preset", { p_preset: id });
  if (error) return { error: toKoreanError(error) };
  refresh();
  return {};
}
