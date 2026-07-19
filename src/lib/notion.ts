// 서버 전용: NOTION_API_KEY는 서버 환경변수이므로 클라이언트 컴포넌트에서 import하지 말 것.
import { Client, isFullDatabase, isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import type { Material } from "@/lib/types";

const PROPERTY = {
  title: "제목",
  type: "유형",
  event: "이벤트",
  url: "링크",
  date: "날짜",
} as const;

export function plainText(prop: unknown): string {
  if (typeof prop !== "object" || prop === null || !("type" in prop)) {
    return "";
  }

  const value = prop as Record<string, unknown>;

  switch (value.type) {
    case "title":
    case "rich_text": {
      const items = value[value.type];
      if (!Array.isArray(items)) return "";
      return items
        .map((item) =>
          typeof item === "object" && item !== null
            ? (item as { plain_text?: unknown }).plain_text
            : undefined,
        )
        .filter((t): t is string => typeof t === "string")
        .join("");
    }
    case "select": {
      const select = value.select as { name?: unknown } | null | undefined;
      return typeof select?.name === "string" ? select.name : "";
    }
    case "url":
      return typeof value.url === "string" ? value.url : "";
    case "date": {
      const date = value.date as { start?: unknown } | null | undefined;
      return typeof date?.start === "string" ? date.start : "";
    }
    default:
      return "";
  }
}

export async function fetchMaterials(): Promise<{
  materials: Material[];
  error?: string;
}> {
  const token = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!token || !databaseId) {
    return { materials: [], error: "노션 연동이 설정되지 않았어요" };
  }

  try {
    const notion = new Client({ auth: token });

    const database = await notion.databases.retrieve({
      database_id: databaseId,
    });
    if (!isFullDatabase(database)) {
      return { materials: [], error: "노션 자료를 불러오지 못했어요" };
    }

    const dataSourceId = database.data_sources[0]?.id;
    if (!dataSourceId) {
      return { materials: [], error: "노션 자료를 불러오지 못했어요" };
    }

    const results = [];
    let cursor: string | undefined;
    let hasMore = true;
    let pageCount = 0;
    const MAX_PAGES = 10;

    while (hasMore && pageCount < MAX_PAGES) {
      const response = await notion.dataSources.query({
        data_source_id: dataSourceId,
        start_cursor: cursor,
      });
      results.push(...response.results);
      hasMore = response.has_more;
      cursor = response.next_cursor ?? undefined;
      pageCount += 1;
    }

    const materials: Material[] = results
      .filter(isFullPage)
      .map((page) => ({
        id: page.id,
        title: plainText(page.properties[PROPERTY.title]),
        type: plainText(page.properties[PROPERTY.type]),
        event: plainText(page.properties[PROPERTY.event]),
        url: plainText(page.properties[PROPERTY.url]),
        date: plainText(page.properties[PROPERTY.date]),
        notionUrl: page.url,
      }));

    return { materials };
  } catch {
    return { materials: [], error: "노션 자료를 불러오지 못했어요" };
  }
}

const MEETING_PROPERTY = {
  title: "제목",
  date: "일시",
  mode: "방식",
  summary: "공개 요약",
} as const;

export interface ParsedMeeting {
  notion_page_id: string;
  title: string;
  meeting_date: string | null;
  mode: "online" | "offline";
  summary: string;
  notion_url: string;
}

export function parseMeetingPage(page: PageObjectResponse): ParsedMeeting {
  const mode = plainText(page.properties[MEETING_PROPERTY.mode]);
  return {
    notion_page_id: page.id,
    title: plainText(page.properties[MEETING_PROPERTY.title]),
    meeting_date: plainText(page.properties[MEETING_PROPERTY.date]) || null,
    mode: mode === "오프라인" ? "offline" : "online",
    summary: plainText(page.properties[MEETING_PROPERTY.summary]),
    notion_url: page.url,
  };
}

export async function fetchPublishedMeetings(): Promise<{
  meetings: ParsedMeeting[];
  error?: string;
}> {
  const token = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_MEETINGS_DATABASE_ID;

  if (!token || !databaseId) {
    return { meetings: [], error: "노션 회의록 연동이 설정되지 않았어요" };
  }

  try {
    const notion = new Client({ auth: token });
    const database = await notion.databases.retrieve({ database_id: databaseId });
    if (!isFullDatabase(database)) {
      return { meetings: [], error: "노션 회의록을 불러오지 못했어요" };
    }
    const dataSourceId = database.data_sources[0]?.id;
    if (!dataSourceId) {
      return { meetings: [], error: "노션 회의록을 불러오지 못했어요" };
    }

    const results = [];
    let cursor: string | undefined;
    let hasMore = true;
    let pageCount = 0;
    const MAX_PAGES = 20;

    while (hasMore && pageCount < MAX_PAGES) {
      const response = await notion.dataSources.query({
        data_source_id: dataSourceId,
        start_cursor: cursor,
        filter: { property: "사이트 공개", checkbox: { equals: true } },
      });
      results.push(...response.results);
      hasMore = response.has_more;
      cursor = response.next_cursor ?? undefined;
      pageCount += 1;
    }

    return { meetings: results.filter(isFullPage).map(parseMeetingPage) };
  } catch {
    return { meetings: [], error: "노션 회의록을 불러오지 못했어요" };
  }
}
