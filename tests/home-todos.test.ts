import { describe, expect, it } from "vitest";
import { homeTodos } from "@/lib/home-todos";
import type { Event } from "@/lib/types";

const NOW = Date.parse("2026-10-18T03:00:00.000Z");
const DAY = 86_400_000;

const event = (id: string, starts_at: string, event_date: string | null = starts_at.slice(0, 10)): Event => ({
  id,
  type: "session",
  title: id,
  description: "",
  starts_at,
  ends_at: null,
  event_date,
  location: "",
  address: "",
  speaker: "",
  capacity: 10,
  created_by: null,
  created_at: "2026-10-01T00:00:00.000Z",
});

const notice = (id: string, published_at: string | null) => ({ id, title: id, published_at });

const empty = {
  events: [],
  registeredEventIds: new Set<string>(),
  openSurveys: [],
  respondedSurveyIds: new Set<string>(),
  notices: [],
  now: NOW,
};

const ids = (todos: ReturnType<typeof homeTodos>) =>
  todos.map((todo) => `${todo.kind}:${todo.kind === "event" ? todo.event.id : todo.kind === "survey" ? todo.survey.id : todo.notice.id}`);

describe("homeTodos", () => {
  it("할 일이 없으면 빈 목록", () => {
    expect(homeTodos(empty)).toEqual([]);
  });

  it("이미 신청했거나 시작한 이벤트, 날짜 미정 이벤트, 응답한 설문은 뺀다", () => {
    const todos = homeTodos({
      ...empty,
      events: [
        event("started", "2026-10-18T02:00:00.000Z"),
        event("registered", "2026-10-25T10:00:00.000Z"),
        event("undated", "2026-10-26T10:00:00.000Z", null),
        event("open", "2026-10-30T10:00:00.000Z"),
      ],
      registeredEventIds: new Set(["registered"]),
      openSurveys: [{ id: "done", title: "done" }, { id: "todo", title: "todo" }],
      respondedSurveyIds: new Set(["done"]),
    });
    expect(ids(todos)).toEqual(["event:open", "survey:todo"]);
  });

  it("이벤트는 가까운 순, 종류마다 최대 2개, 이벤트 → 설문 → 공지 순", () => {
    const todos = homeTodos({
      ...empty,
      events: [
        event("far", "2026-11-20T10:00:00.000Z"),
        event("near", "2026-10-20T10:00:00.000Z"),
        event("mid", "2026-11-01T10:00:00.000Z"),
      ],
      openSurveys: [{ id: "s1", title: "s1" }, { id: "s2", title: "s2" }, { id: "s3", title: "s3" }],
      notices: [notice("n1", new Date(NOW - DAY).toISOString())],
    });
    expect(ids(todos)).toEqual(["event:near", "event:mid", "survey:s1", "survey:s2", "notice:n1"]);
  });

  it("공지는 게시 7일 경계까지 포함하고 그보다 오래되거나 미게시면 뺀다", () => {
    const todos = homeTodos({
      ...empty,
      notices: [
        notice("exactly7d", new Date(NOW - 7 * DAY).toISOString()),
        notice("over7d", new Date(NOW - 7 * DAY - 1).toISOString()),
        notice("unpublished", null),
      ],
    });
    expect(ids(todos)).toEqual(["notice:exactly7d"]);
  });
});
