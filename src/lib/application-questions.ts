import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import type { ApplicationQuestion, Position } from "@/lib/types";

export const DEFAULT_APPLICATION_QUESTIONS: ApplicationQuestion[] = [
  { id: "intro", position: "frontend", label: "자기소개", sort_order: 0, created_by: null, created_at: "", updated_at: "" },
  { id: "motivation", position: "frontend", label: "지원 동기", sort_order: 1, created_by: null, created_at: "", updated_at: "" },
  { id: "interest", position: "frontend", label: "관심 분야", sort_order: 2, created_by: null, created_at: "", updated_at: "" },
];

export async function getApplicationQuestionsFor(position: Position): Promise<ApplicationQuestion[]> {
  if (await isDemoMode()) return DEFAULT_APPLICATION_QUESTIONS.map((question) => ({ ...question, position }));
  const supabase = await createClient();
  const { data, error } = await supabase.from("application_questions").select("*").eq("position", position).order("sort_order", { ascending: true });
  if (error) return DEFAULT_APPLICATION_QUESTIONS.map((question) => ({ ...question, position }));
  return (data as ApplicationQuestion[] | null) ?? [];
}

export async function getAllApplicationQuestions(): Promise<ApplicationQuestion[]> {
  if (await isDemoMode()) {
    return ["frontend", "backend", "designer", "beginner", "pm", "marketer", "vibecoder"].flatMap((position) =>
      DEFAULT_APPLICATION_QUESTIONS.map((question) => ({ ...question, position: position as Position })),
    );
  }
  const supabase = await createClient();
  const { data } = await supabase.from("application_questions").select("*").order("position", { ascending: true }).order("sort_order", { ascending: true });
  return (data as ApplicationQuestion[] | null) ?? [];
}
