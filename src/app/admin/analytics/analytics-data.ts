import {
  getAcquisition,
  getDomainEvents,
  getTopPages,
  getTrafficOverview,
  TRACKED_EVENTS,
  type DateRange,
} from "@/lib/ga4";
import { getLatestDeployment } from "@/lib/vercel";

export function rangeFor(days: number): DateRange {
  return { startDate: `${days}daysAgo`, endDate: "today" };
}

export function previousRangeFor(days: number): DateRange {
  return { startDate: `${days * 2}daysAgo`, endDate: `${days + 1}daysAgo` };
}

function sumTraffic(points: { activeUsers: number; sessions: number; pageViews: number }[]) {
  return points.reduce(
    (total, point) => ({
      users: total.users + point.activeUsers,
      sessions: total.sessions + point.sessions,
      views: total.views + point.pageViews,
    }),
    { users: 0, sessions: 0, views: 0 },
  );
}

function sumEvents(events: { count: number }[] | null) {
  return (events ?? []).reduce((total, event) => total + event.count, 0);
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 10) / 10 : 0;
}

export function summarizeAnalytics(
  traffic: { activeUsers: number; sessions: number; pageViews: number }[],
  previousTraffic: { activeUsers: number; sessions: number; pageViews: number }[] | null,
  events: { name: string; count: number }[] | null,
  previousEvents: { name: string; count: number }[] | null,
) {
  const totals = sumTraffic(traffic);
  const previousTotals = previousTraffic ? sumTraffic(previousTraffic) : undefined;
  return {
    totals,
    previousTotals,
    conversions: sumEvents(events),
    previousConversions: previousEvents ? sumEvents(previousEvents) : undefined,
    visits: ratio(totals.sessions, totals.users),
    previousVisits: previousTotals && ratio(previousTotals.sessions, previousTotals.users),
    depth: ratio(totals.views, totals.sessions),
    previousDepth: previousTotals && ratio(previousTotals.views, previousTotals.sessions),
    eventRows: TRACKED_EVENTS.map((name) => ({
      name,
      count: events?.find((event) => event.name === name)?.count ?? 0,
    })),
  };
}

export async function loadAnalyticsOverview(days: number) {
  const range = rangeFor(days);
  const previousRange = previousRangeFor(days);
  const [traffic, channels, pages, events, deployment, previousTraffic, previousEvents] =
    await Promise.all([
      getTrafficOverview(range),
      getAcquisition(range),
      getTopPages(range),
      getDomainEvents(range),
      getLatestDeployment(),
      getTrafficOverview(previousRange),
      getDomainEvents(previousRange),
    ]);

  if (traffic === null) return { traffic, channels, pages, deployment };
  return {
    traffic,
    channels,
    pages,
    deployment,
    ...summarizeAnalytics(traffic, previousTraffic, events, previousEvents),
  };
}
