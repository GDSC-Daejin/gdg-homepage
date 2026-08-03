import Link from "next/link";
import { type ReactNode } from "react";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { labelChannel, labelEvent, labelPage } from "@/lib/analytics-labels";
import { type Deployment } from "@/lib/vercel";
import { OverviewTabs } from "../OverviewTabs";
import {
  isMetricKey,
  TrafficChart,
  TRAFFIC_METRICS,
  type MetricKey,
} from "./TrafficChart";
import { loadAnalyticsOverview } from "./analytics-data";

const clarityProjectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; metric?: string }>;
}) {
  const { range: rangeParam, metric: metricParam } = await searchParams;
  const selectedRange = rangeParam === "7d" ? "7d" : "30d";
  const selectedMetric: MetricKey = isMetricKey(metricParam)
    ? metricParam
    : "sessions";
  const days = selectedRange === "7d" ? 7 : 30;
  const overview = await loadAnalyticsOverview(days);
  const { traffic, channels, pages, deployment } = overview;

  if (traffic === null) {
    return (
      <div className="flex flex-col gap-6">
        <OverviewTabs />
        <PageHeader title="분석" description="웹사이트 이용 현황을 확인해요" />
        <DeploymentCard deployment={deployment} />
        <Card className="p-8 text-center text-gray-500">
          분석이 설정되지 않았습니다. GA4 환경변수를 확인하세요.
        </Card>
      </div>
    );
  }

  const { totals, previousTotals: prevTotals, conversions, previousConversions: prevConversions,
    visits, previousVisits: prevVisits, depth, previousDepth: prevDepth, eventRows } = overview;

  return (
    <div className="flex flex-col gap-6">
      <OverviewTabs />
      <PageHeader
        title="분석"
        description="웹사이트 이용 현황을 확인해요"
        action={
          <TabGroup>
            <TabLink
              href={`?range=7d&metric=${selectedMetric}`}
              active={selectedRange === "7d"}
              label="7일"
            />
            <TabLink
              href={`?range=30d&metric=${selectedMetric}`}
              active={selectedRange === "30d"}
              label="30일"
            />
          </TabGroup>
        }
      />

      <DeploymentCard deployment={deployment} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="찾아온 사람"
          value={`${totals.users.toLocaleString("ko-KR")}명`}
          hint={
            <StatHint
              current={totals.users}
              previous={prevTotals?.users}
              note="같은 사람이 여러 번 와도 1명. 많을수록 사이트가 잘 알려진 것"
            />
          }
        />
        <StatCard
          label="1인당 방문 횟수"
          value={`${visits}번`}
          hint={
            <StatHint
              current={visits}
              previous={prevVisits}
              note="한 사람이 평균 몇 번 왔는지. 높을수록 다시 찾아온다는 뜻"
            />
          }
        />
        <StatCard
          label="한 번에 보는 페이지"
          value={`${depth}쪽`}
          hint={
            <StatHint
              current={depth}
              previous={prevDepth}
              note="방문 1회당 평균. 높을수록 그냥 나가지 않고 둘러봤다는 뜻"
            />
          }
        />
        <StatCard
          label="실제 행동한 횟수"
          value={`${conversions.toLocaleString("ko-KR")}회`}
          hint={
            <StatHint
              current={conversions}
              previous={prevConversions}
              note="지원·로그인·출석·설문 합계. 보기만 하지 않고 움직인 횟수"
            />
          }
        />
      </div>

      <Section
        title="추이"
        hint="그래프 위에 마우스를 올리면 날짜별 수치를 볼 수 있어요"
        action={
          <TabGroup>
            {Object.entries(TRAFFIC_METRICS).map(([key, { label }]) => (
              <TabLink
                key={key}
                href={`?range=${selectedRange}&metric=${key}`}
                active={key === selectedMetric}
                label={label}
              />
            ))}
          </TabGroup>
        }
      >
        <TrafficChart data={traffic} metric={selectedMetric} />
      </Section>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Section title="어디를 통해 들어왔나" hint="방문 횟수 · 전체 대비 비율">
          <RankTable
            rows={toRows(channels ?? [], (channel) => [
              labelChannel(channel.channel),
              channel.sessions,
            ])}
            total={totals.sessions}
          />
        </Section>
        <Section title="어떤 페이지를 많이 봤나" hint="열어본 횟수 · 전체 대비 비율">
          <RankTable
            rows={toRows(pages ?? [], (page) => [labelPage(page.path), page.views])}
            total={totals.views}
          />
        </Section>
      </div>

      <Section title="무엇을 했나" hint="실제 행동 횟수 · 전체 대비 비율">
        <RankTable
          rows={toRows(eventRows, (event) => [
            labelEvent(event.name),
            event.count,
          ])}
          total={conversions}
        />
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

function TabGroup({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-1 rounded-md bg-gray-100 p-1 text-sm">{children}</div>
  );
}

function TabLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      // 페이지 중간의 토글이라 이동 시 상단으로 튀지 않게 한다.
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={`rounded px-2 py-1 ${
        active ? "bg-primary text-white" : "text-gray-600 hover:bg-white"
      }`}
    >
      {label}
    </Link>
  );
}

function DeploymentCard({ deployment }: { deployment: Deployment | null }) {
  if (!deployment) return null;

  const status =
    deployment.state === "READY"
      ? { label: "정상 운영 중", dot: "bg-green-500", text: "text-green-700" }
      : deployment.state === "ERROR" || deployment.state === "CANCELED"
        ? { label: "업데이트 실패", dot: "bg-red-500", text: "text-red-700" }
        : { label: "업데이트 중", dot: "bg-yellow-500", text: "text-yellow-700" };
  const when = deployment.createdAt
    ? new Date(deployment.createdAt).toLocaleString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "-";

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-700">웹사이트 상태</h2>
        <span
          className={`inline-flex items-center gap-1.5 text-sm font-medium ${status.text}`}
        >
          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        마지막 업데이트 · {when}
        {deployment.commitAuthor && ` · ${deployment.commitAuthor}`}
      </p>
      {deployment.commitMessage && (
        <p
          className="mt-1 truncate text-xs text-gray-400"
          title={deployment.commitMessage}
        >
          최근 변경: {deployment.commitMessage}
        </p>
      )}
    </Card>
  );
}

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function StatHint({
  current,
  previous,
  note,
}: {
  current: number;
  previous?: number;
  note: string;
}) {
  return (
    <>
      <span className="block">
        <Delta current={current} previous={previous} />
      </span>
      <span className="mt-1 block leading-snug text-gray-400">{note}</span>
    </>
  );
}

function Delta({
  current,
  previous,
}: {
  current: number;
  previous?: number;
}) {
  if (previous === undefined) return null;
  if (previous === 0) {
    return <span className="text-gray-400">이전 기간 데이터 없음</span>;
  }

  const change = Math.round(((current - previous) / previous) * 100);
  const tone =
    change > 0 ? "text-success" : change < 0 ? "text-danger" : "text-gray-400";

  return (
    <span className={tone}>
      {change > 0 ? "▲" : change < 0 ? "▼" : "―"} {Math.abs(change)}%
      <span className="text-gray-400"> · 직전 {previous.toLocaleString("ko-KR")}</span>
    </span>
  );
}

// 라벨 변환 후 같은 라벨(동적 상세 페이지 등)을 합산하고 값 기준 내림차순 정렬.
function toRows<T>(
  items: T[],
  toEntry: (item: T) => [string, number],
): [string, number][] {
  const totals = new Map<string, number>();
  for (const item of items) {
    const [label, value] = toEntry(item);
    totals.set(label, (totals.get(label) ?? 0) + value);
  }
  return [...totals].sort((a, b) => b[1] - a[1]);
}

function RankTable({
  rows,
  total,
}: {
  rows: [string, number][];
  total: number;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">데이터가 없습니다.</p>;
  }

  const max = Math.max(...rows.map(([, value]) => value), 1);

  // 막대는 행 배경으로 깔고 숫자를 앞세운다 — 크기 비교는 곁눈질로 되면 충분.
  return (
    <ul className="flex flex-col gap-1">
      {rows.map(([label, value]) => (
        <li
          key={label}
          className="relative flex items-center gap-3 overflow-hidden rounded-md px-2.5 py-2"
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 bg-primary-soft"
            style={{ width: `${(value / max) * 100}%` }}
          />
          <span
            className="relative min-w-0 flex-1 truncate text-sm text-gray-700"
            title={label}
          >
            {label}
          </span>
          <span className="relative shrink-0 text-lg font-semibold tabular-nums text-gray-900">
            {value.toLocaleString("ko-KR")}
          </span>
          <span className="relative w-10 shrink-0 text-right text-xs tabular-nums text-gray-400">
            {total > 0 ? `${Math.round((value / total) * 100)}%` : "-"}
          </span>
        </li>
      ))}
    </ul>
  );
}
