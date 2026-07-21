import Link from "next/link";
import { type ReactNode } from "react";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import {
  getAcquisition,
  getDomainEvents,
  getTopPages,
  getTrafficOverview,
  type DateRange,
} from "@/lib/ga4";
import { TrafficChart } from "./TrafficChart";

const clarityProjectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

function rangeFor(range?: string): DateRange {
  const days = range === "7d" ? 7 : 30;
  return { startDate: `${days}daysAgo`, endDate: "today" };
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const selectedRange = rangeParam === "7d" ? "7d" : "30d";
  const range = rangeFor(selectedRange);
  const [traffic, channels, pages, events] = await Promise.all([
    getTrafficOverview(range),
    getAcquisition(range),
    getTopPages(range),
    getDomainEvents(range),
  ]);

  if (traffic === null) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="분석" description="웹사이트 이용 현황을 확인해요" />
        <Card className="p-8 text-center text-gray-500">
          분석이 설정되지 않았습니다. GA4 환경변수를 확인하세요.
        </Card>
      </div>
    );
  }

  const totals = traffic.reduce(
    (total, point) => ({
      users: total.users + point.activeUsers,
      sessions: total.sessions + point.sessions,
      views: total.views + point.pageViews,
    }),
    { users: 0, sessions: 0, views: 0 },
  );
  const conversions = (events ?? []).reduce(
    (total, event) => total + event.count,
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="분석"
        description="웹사이트 이용 현황을 확인해요"
        action={
          <div className="flex gap-1 rounded-md bg-gray-100 p-1 text-sm">
            <RangeLink range="7d" selected={selectedRange} label="7일" />
            <RangeLink range="30d" selected={selectedRange} label="30일" />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="활성 유저" value={totals.users} />
        <StatCard label="세션" value={totals.sessions} />
        <StatCard label="페이지뷰" value={totals.views} />
        <StatCard label="주요 전환" value={conversions} />
      </div>

      <Section title="트래픽 추이 (세션)">
        <TrafficChart data={traffic} />
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="유입 경로">
          <RankTable rows={(channels ?? []).map((channel) => [channel.channel, channel.sessions])} />
        </Section>
        <Section title="인기 페이지">
          <RankTable rows={(pages ?? []).map((page) => [page.path, page.views])} />
        </Section>
      </div>

      <Section title="도메인 이벤트">
        <RankTable rows={(events ?? []).map((event) => [event.name, event.count])} />
      </Section>

      {clarityProjectId && (
        <a
          href={`https://clarity.microsoft.com/projects/view/${clarityProjectId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Clarity 세션 리플레이 보기 →
        </a>
      )}
    </div>
  );
}

function RangeLink({
  range,
  selected,
  label,
}: {
  range: "7d" | "30d";
  selected: "7d" | "30d";
  label: string;
}) {
  return (
    <Link
      href={`?range=${range}`}
      className={`rounded px-2 py-1 ${
        range === selected ? "bg-primary text-white" : "text-gray-600 hover:bg-white"
      }`}
    >
      {label}
    </Link>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-gray-700">{title}</h2>
      {children}
    </Card>
  );
}

function RankTable({ rows }: { rows: [string, number][] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">데이터가 없습니다.</p>;
  }

  const max = Math.max(...rows.map(([, value]) => value), 1);

  return (
    <ul className="flex flex-col gap-2">
      {rows.map(([label, value]) => (
        <li key={label} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-sm text-gray-700" title={label}>
            {label}
          </span>
          <span className="relative h-2 flex-1 rounded bg-gray-100">
            <span
              className="absolute inset-y-0 left-0 rounded bg-primary"
              style={{ width: `${(value / max) * 100}%` }}
            />
          </span>
          <span className="w-12 shrink-0 text-right text-sm tabular-nums text-gray-900">
            {value.toLocaleString("ko-KR")}
          </span>
        </li>
      ))}
    </ul>
  );
}
