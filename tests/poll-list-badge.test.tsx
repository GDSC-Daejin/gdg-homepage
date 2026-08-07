import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PollList, type PollCard } from "@/app/schedule/PollList";
import type { MeetingPoll } from "@/lib/types";

const HOUR = 60 * 60 * 1000;

function card(overrides: Partial<MeetingPoll>): PollCard {
  return {
    poll: {
      id: "poll-1",
      title: "디자이너 작당모의",
      dates: ["2026-08-05"],
      start_hour: 0,
      end_hour: 24,
      slot_min: 30,
      due_at: null,
      confirmed_at: null,
      duration_min: null,
      is_mojisoop: false,
      is_regular_session: false,
      ...overrides,
    } as MeetingPoll,
    total: 4,
    responded: 4,
    people: [],
  };
}

function render(overrides: Partial<MeetingPoll>): string {
  return renderToStaticMarkup(<PollList cards={[card(overrides)]} emptyTitle="" emptyBody="" />);
}

describe("일정 목록 배지", () => {
  it("마감 전이면 응답 받는 중", () => {
    const markup = render({ due_at: new Date(Date.now() + HOUR).toISOString() });
    expect(markup).toContain("응답 받는 중");
    expect(markup).not.toContain("응답 마감");
  });

  it("마감이 지났으면 응답 마감", () => {
    // "응답 종료" 버튼은 due_at을 지금으로 당긴다. 그때 지난 일정 탭에서
    // "응답 받는 중"으로 보이면 아직 받는 줄 알고 다시 들어가게 된다.
    const markup = render({ due_at: new Date(Date.now() - HOUR).toISOString() });
    expect(markup).toContain("응답 마감");
    expect(markup).not.toContain("응답 받는 중");
  });

  it("마감이 지나도 확정됐으면 확정됨이 이긴다", () => {
    const markup = render({
      due_at: new Date(Date.now() - HOUR).toISOString(),
      confirmed_at: new Date(Date.now() - HOUR).toISOString(),
      duration_min: 60,
    });
    expect(markup).toContain("확정됨");
    expect(markup).not.toContain("응답 마감");
    expect(markup).not.toContain("응답 받는 중");
  });

  it("마감이 없으면 응답 받는 중", () => {
    const markup = render({ due_at: null });
    expect(markup).toContain("응답 받는 중");
  });
});
