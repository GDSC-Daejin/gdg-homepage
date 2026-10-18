"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { applicationQuestionPresetSchema, applicationQuestionSchema } from "@/lib/schemas";
import { toKoreanError } from "@/lib/errors";
import { isDemoMode } from "@/lib/demo";
import type { ActionResult, ApplicationQuestionPreset, Position } from "@/lib/types";

function refresh() {
  revalidatePath("/admin/questions");
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
  const { data, error } = await (await createClient()).from("application_questions").update({ label: parsed.data, updated_at: new Date().toISOString() }).eq("id", id).select("id");
  if (error) return { error: toKoreanError(error) };
  // RLS에 막히거나 이미 지워진 질문이면 오류 없이 0행이 바뀐다 — 성공으로 보이지 않게 한다.
  if (!data?.length) return { error: toKoreanError({ message: "NOT_FOUND" }) };
  refresh();
  return {};
}

export async function deleteApplicationQuestion(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  const { data, error } = await (await createClient()).from("application_questions").delete().eq("id", id).select("id");
  if (error) return { error: toKoreanError(error) };
  if (!data?.length) return { error: toKoreanError({ message: "NOT_FOUND" }) };
  refresh();
  return {};
}

/** 포지션의 질문 순서를 ids 순서로 바꾼다. 화면이 본 목록과 DB 목록이 다르면 덮어쓰지 않는다. */
export async function reorderApplicationQuestions(position: Position, ids: string[]): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  const parsedPosition = applicationQuestionSchema.shape.position.safeParse(position);
  if (!parsedPosition.success) return { error: "포지션을 확인해주세요" };
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== "string") || new Set(ids).size !== ids.length) {
    return { error: "질문 순서를 확인해주세요" };
  }
  const supabase = await createClient();
  const { data: current, error: readError } = await supabase.from("application_questions").select("id").eq("position", parsedPosition.data);
  if (readError) return { error: toKoreanError(readError) };
  const currentIds = new Set((current ?? []).map((row: { id: string }) => row.id));
  if (currentIds.size !== ids.length || ids.some((id) => !currentIds.has(id))) {
    return { error: "다른 곳에서 질문이 바뀌었어요. 새로고침한 뒤 다시 시도해주세요" };
  }
  const updatedAt = new Date().toISOString();
  const results = await Promise.all(ids.map((id, index) => supabase
    .from("application_questions")
    .update({ sort_order: index, updated_at: updatedAt })
    .eq("id", id)
    .eq("position", parsedPosition.data)
    .select("id")));
  const failed = results.find((result) => result.error || !result.data?.length);
  if (failed) return { error: failed.error ? toKoreanError(failed.error) : toKoreanError({ message: "NOT_FOUND" }) };
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
