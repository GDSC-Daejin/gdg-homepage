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

const LEGACY_ANSWER_LABELS: Record<string, string> = {
  intro: "자기소개",
  motivation: "지원 동기",
  interest: "관심 분야",
};

export type ApplicationAnswerRow = { key: string; label: string; answer: string };

/**
 * 지원서 답변을 질문 라벨과 짝지어 보여줄 행을 만든다.
 *
 * 답변은 제출 당시 질문 id를 키로 저장된다. 이후 질문을 지우거나 프리셋으로 교체하면
 * 현재 질문 목록만으로는 그 답변을 찾을 수 없다 — 0119 이전 지원서(intro·motivation·interest)도 같다.
 * 현재 질문에 없는 답변도 숨기지 않고 뒤에 붙인다.
 */
export function buildApplicationAnswerRows(
  questions: Pick<ApplicationQuestion, "id" | "label">[],
  answers: Record<string, string>,
): ApplicationAnswerRow[] {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(answers, key);
  const rows: ApplicationAnswerRow[] = questions
    .filter((question) => has(question.id))
    .map((question) => ({ key: question.id, label: question.label, answer: answers[question.id] }));
  const shown = new Set(rows.map((row) => row.key));
  const legacyOrder = Object.keys(LEGACY_ANSWER_LABELS);
  const rest = Object.keys(answers)
    .filter((key) => !shown.has(key))
    .sort((a, b) => {
      const ai = legacyOrder.indexOf(a);
      const bi = legacyOrder.indexOf(b);
      return (ai === -1 ? legacyOrder.length : ai) - (bi === -1 ? legacyOrder.length : bi);
    });
  for (const key of rest) {
    rows.push({ key, label: LEGACY_ANSWER_LABELS[key] ?? "삭제되거나 바뀐 질문", answer: answers[key] });
  }
  return rows;
}
