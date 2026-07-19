import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { DEMO_INTERVIEW_QUESTIONS } from "@/lib/demoData";
import type { InterviewQuestion, Position } from "@/lib/types";

/** 지원자 상세용: 해당 포지션 질문 + 공통(position IS NULL) 질문 */
export async function getInterviewQuestionsFor(
  position: Position | null,
): Promise<InterviewQuestion[]> {
  if (await isDemoMode()) {
    return DEMO_INTERVIEW_QUESTIONS.filter(
      (q) => q.position === null || q.position === position,
    );
  }

  const supabase = await createClient();
  const base = supabase
    .from("interview_questions")
    .select("*")
    .order("created_at", { ascending: true });
  const { data } = position
    ? await base.or(`position.eq.${position},position.is.null`)
    : await base.is("position", null);

  return (data as InterviewQuestion[] | null) ?? [];
}

/** 관리 페이지용: 전체 질문 */
export async function getAllInterviewQuestions(): Promise<InterviewQuestion[]> {
  if (await isDemoMode()) return DEMO_INTERVIEW_QUESTIONS;

  const supabase = await createClient();
  const { data } = await supabase
    .from("interview_questions")
    .select("*")
    .order("created_at", { ascending: true });

  return (data as InterviewQuestion[] | null) ?? [];
}
