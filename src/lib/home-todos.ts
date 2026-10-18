import type { Event, Notice } from "@/lib/types";

export const RECENT_NOTICE_DAYS = 7;
const PER_KIND_LIMIT = 2;
const DAY_MS = 86_400_000;

export type HomeTodo =
  | { kind: "event"; event: Event }
  | { kind: "survey"; survey: { id: string; title: string } }
  | { kind: "notice"; notice: Pick<Notice, "id" | "title" | "published_at"> & { published_at: string } };

/**
 * 회원 홈 "다음에 할 일".
 * - 이벤트: 아직 시작 전이고 내가 신청하지 않은 것(정원이 차도 대기 신청은 가능)
 * - 설문: 열려 있고 아직 응답하지 않은 것
 * - 공지: 게시한 지 7일(경계 포함) 이내인 것
 * 종류마다 최대 2개, 이벤트 → 설문 → 공지 순.
 */
export function homeTodos({
  events,
  registeredEventIds,
  openSurveys,
  respondedSurveyIds,
  notices,
  now = Date.now(),
}: {
  events: Event[];
  registeredEventIds: ReadonlySet<string>;
  openSurveys: { id: string; title: string }[];
  respondedSurveyIds: ReadonlySet<string>;
  notices: Pick<Notice, "id" | "title" | "published_at">[];
  now?: number;
}): HomeTodo[] {
  const eventTodos = events
    // 날짜가 정해지지 않은 이벤트(event_date 없음)는 홈의 다른 곳과 같이 "일시 미정"으로 보고 뺀다
    .filter((event) => event.event_date && event.starts_at && Date.parse(event.starts_at) > now)
    .filter((event) => !registeredEventIds.has(event.id))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
    .slice(0, PER_KIND_LIMIT)
    .map((event): HomeTodo => ({ kind: "event", event }));

  const surveyTodos = openSurveys
    .filter((survey) => !respondedSurveyIds.has(survey.id))
    .slice(0, PER_KIND_LIMIT)
    .map((survey): HomeTodo => ({ kind: "survey", survey }));

  const since = now - RECENT_NOTICE_DAYS * DAY_MS;
  const noticeTodos = notices
    .filter((notice): notice is typeof notice & { published_at: string } => notice.published_at !== null)
    .filter((notice) => {
      const at = Date.parse(notice.published_at);
      return at >= since && at <= now;
    })
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
    .slice(0, PER_KIND_LIMIT)
    .map((notice): HomeTodo => ({ kind: "notice", notice }));

  return [...eventTodos, ...surveyTodos, ...noticeTodos];
}
