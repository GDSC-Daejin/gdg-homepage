import { describe, it, expect } from "vitest";
import { parseMeetingPage, weeklyTitle } from "@/lib/notion";
import type { PageObjectResponse } from "@notionhq/client";

function fixture(): PageObjectResponse {
  return {
    id: "page-123",
    url: "https://notion.so/page-123",
    properties: {
      제목: { type: "title", title: [{ plain_text: "7월 3주차 모지숲" }] },
      일시: { type: "date", date: { start: "2026-07-19" } },
      방식: { type: "select", select: { name: "오프라인" } },
      "공개 요약": {
        type: "rich_text",
        rich_text: [{ plain_text: "예산 승인, 데브페스트 일정 확정." }],
      },
    },
  } as unknown as PageObjectResponse;
}

describe("parseMeetingPage", () => {
  it("노션 페이지를 ParsedMeeting으로 매핑한다", () => {
    const m = parseMeetingPage(fixture());
    expect(m).toEqual({
      notion_page_id: "page-123",
      title: "7월 3주차 모지숲",
      meeting_date: "2026-07-19",
      mode: "offline",
      summary: "예산 승인, 데브페스트 일정 확정.",
      notion_url: "https://notion.so/page-123",
    });
  });

  it("방식이 오프라인이 아니면 online으로 폴백한다", () => {
    const page = fixture();
    (page.properties["방식"] as { select: { name: string } }).select.name = "온라인";
    expect(parseMeetingPage(page).mode).toBe("online");
  });

  it("일시가 비면 meeting_date는 null이다", () => {
    const page = fixture();
    (page.properties["일시"] as { date: unknown }).date = null;
    expect(parseMeetingPage(page).meeting_date).toBeNull();
  });
});

describe("weeklyTitle", () => {
  it("확정 시각을 KST 기준 \"n월 n일 위클리\"로 만든다", () => {
    expect(weeklyTitle("2026-07-31T10:00:00.000Z")).toBe("7월 31일 위클리");
  });

  it("UTC로는 전날인 새벽 시각도 KST 날짜를 쓴다", () => {
    // KST 2026-08-01 00:30
    expect(weeklyTitle("2026-07-31T15:30:00.000Z")).toBe("8월 1일 위클리");
  });
});
