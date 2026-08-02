import "server-only";
import { JWT } from "google-auth-library";

export type DateRange = { startDate: string; endDate: string };

export type TrafficPoint = {
  date: string;
  activeUsers: number;
  sessions: number;
  pageViews: number;
};

export type ChannelRow = { channel: string; sessions: number };
export type PageRow = { path: string; views: number };
export type EventRow = { name: string; count: number };

const propertyId = process.env.GA4_PROPERTY_ID;
const clientEmail = process.env.GA_SA_CLIENT_EMAIL;
const privateKey = process.env.GA_SA_PRIVATE_KEY?.replace(/\\n/g, "\n");

// /admin은 운영진 내부 활동이라 GA4 리포트에서도 제외.
// 클라이언트 ga-disable은 best-effort라 과거 데이터·SPA 이동 레이스로 새어들어오므로
// 서버 쿼리에서 pagePath 기준으로 확실히 걸러낸다.
const EXCLUDE_ADMIN = {
  notExpression: {
    filter: {
      fieldName: "pagePath",
      stringFilter: { matchType: "BEGINS_WITH", value: "/admin" },
    },
  },
} as const;

export function parseRows(json: unknown): string[][] {
  const rows = (json as { rows?: unknown[] } | null)?.rows;
  if (!Array.isArray(rows)) return [];

  return rows.map((item) => {
    const row = item as {
      dimensionValues?: { value?: string }[];
      metricValues?: { value?: string }[];
    };

    return [
      ...(row.dimensionValues ?? []).map((value) => value.value ?? ""),
      ...(row.metricValues ?? []).map((value) => value.value ?? ""),
    ];
  });
}

export function mapTraffic(json: unknown): TrafficPoint[] {
  return parseRows(json).map(([date, activeUsers, sessions, pageViews]) => ({
    date,
    activeUsers: Number(activeUsers ?? 0),
    sessions: Number(sessions ?? 0),
    pageViews: Number(pageViews ?? 0),
  }));
}

export function mapChannels(json: unknown): ChannelRow[] {
  return parseRows(json).map(([channel, sessions]) => ({
    channel,
    sessions: Number(sessions ?? 0),
  }));
}

export function mapPages(json: unknown): PageRow[] {
  return parseRows(json).map(([path, views]) => ({
    path,
    views: Number(views ?? 0),
  }));
}

export function mapEvents(json: unknown): EventRow[] {
  return parseRows(json).map(([name, count]) => ({
    name,
    count: Number(count ?? 0),
  }));
}

async function getAccessToken(): Promise<string | null> {
  if (!clientEmail || !privateKey) return null;

  try {
    const client = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });
    const { access_token: accessToken } = await client.authorize();
    return accessToken ?? null;
  } catch {
    return null;
  }
}

async function runReport(body: Record<string, unknown>): Promise<unknown | null> {
  if (!propertyId) return null;

  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  try {
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        next: { revalidate: 3600 },
      },
    );

    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
}

export async function getTrafficOverview(
  range: DateRange,
): Promise<TrafficPoint[] | null> {
  const json = await runReport({
    dateRanges: [range],
    dimensions: [{ name: "date" }],
    metrics: [
      { name: "activeUsers" },
      { name: "sessions" },
      { name: "screenPageViews" },
    ],
    dimensionFilter: EXCLUDE_ADMIN,
    orderBys: [{ dimension: { dimensionName: "date" } }],
  });

  return json === null ? null : mapTraffic(json);
}

export async function getAcquisition(
  range: DateRange,
  limit = 8,
): Promise<ChannelRow[] | null> {
  const json = await runReport({
    dateRanges: [range],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }],
    dimensionFilter: EXCLUDE_ADMIN,
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit,
  });

  return json === null ? null : mapChannels(json);
}

export async function getTopPages(
  range: DateRange,
  limit = 8,
): Promise<PageRow[] | null> {
  const json = await runReport({
    dateRanges: [range],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }],
    dimensionFilter: EXCLUDE_ADMIN,
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit,
  });

  return json === null ? null : mapPages(json);
}

export const TRACKED_EVENTS = [
  "apply_submit",
  "login",
  "attendance_check",
  "survey_submit",
] as const;

export async function getDomainEvents(
  range: DateRange,
): Promise<EventRow[] | null> {
  const json = await runReport({
    dateRanges: [range],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        inListFilter: { values: [...TRACKED_EVENTS] },
      },
    },
  });

  return json === null ? null : mapEvents(json);
}
