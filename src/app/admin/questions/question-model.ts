import type { ActionResult, ApplicationQuestion, InterviewQuestion, Position } from "@/lib/types";

export type QuestionKind = "application" | "interview";
/** 포지션 패널의 선택값. "common"은 면접 질문의 공통(position IS NULL)만 뜻한다. */
export type PositionKey = Position | "common";

export const POSITIONS: Position[] = ["frontend", "backend", "designer", "beginner", "pm", "marketer", "vibecoder"];

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** /apply와 같은 순서: 해당 포지션 질문을 sort_order 오름차순으로. */
export function applicationQuestionsOf(questions: ApplicationQuestion[], position: Position): ApplicationQuestion[] {
  return questions.filter((question) => question.position === position).sort((a, b) => a.sort_order - b.sort_order);
}

/** 관리 목록: 선택한 포지션(공통이면 position IS NULL)만 등록 순서대로. */
export function interviewQuestionsOf(questions: InterviewQuestion[], key: PositionKey): InterviewQuestion[] {
  const position = key === "common" ? null : key;
  return questions.filter((question) => question.position === position).sort(byCreatedAt);
}

/**
 * 면접관 화면(getInterviewQuestionsFor)과 같은 순서: 포지션 질문과 공통 질문을 섞어 등록 순서대로.
 * 공통을 고르면 공통 질문만 보인다.
 */
export function interviewerViewOrder(questions: InterviewQuestion[], key: PositionKey): InterviewQuestion[] {
  const position = key === "common" ? null : key;
  return questions.filter((question) => question.position === null || question.position === position).sort(byCreatedAt);
}

function byCreatedAt(a: InterviewQuestion, b: InterviewQuestion) {
  return a.created_at.localeCompare(b.created_at);
}

/** 포지션 하나를 새 순서로 바꾸고 sort_order를 0부터 다시 매긴다. 다른 포지션 질문은 그대로 둔다. */
export function reorderPosition(
  questions: ApplicationQuestion[],
  position: Position,
  from: number,
  to: number,
): ApplicationQuestion[] {
  const current = applicationQuestionsOf(questions, position);
  const moved = moveItem(current, from, to);
  if (moved === current) return questions;
  return [
    ...questions.filter((question) => question.position !== position),
    ...moved.map((question, index) => ({ ...question, sort_order: index })),
  ];
}

/** "2026-2" → "2026 하반기 모집". 모르는 형식이면 원문을 그대로 쓴다. */
export function seasonLabel(season: string): string {
  const match = /^(\d{4})-([12])$/.exec(season);
  if (!match) return `${season} 모집`;
  return `${match[1]} ${match[2] === "1" ? "상반기" : "하반기"} 모집`;
}

export type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "demo" }
  | { status: "error"; message: string };

/** 저장을 실행하고 결과 상태를 돌려준다. 오류 응답이나 네트워크 실패면 rollback을 부른다. */
export async function saveWithRollback(
  run: () => Promise<ActionResult | undefined>,
  rollback: () => void,
): Promise<SaveState> {
  try {
    const result = await run();
    if (!result?.error) return { status: "saved" };
    rollback();
    return { status: "error", message: result.error };
  } catch {
    rollback();
    return { status: "error", message: "서버에 연결하지 못했어요" };
  }
}
