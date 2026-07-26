import type { TrafficPoint } from "@/lib/ga4";

const W = 720;
const H = 220;
const PAD = { top: 20, right: 12, bottom: 26, left: 40 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

// 축 최대값을 5/10/100 같은 읽기 쉬운 수로 올림.
function niceMax(value: number): number {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

// GA4 date 차원은 "YYYYMMDD".
function shortDate(date: string): string {
  return `${Number(date.slice(4, 6))}/${Number(date.slice(6, 8))}`;
}

export const TRAFFIC_METRICS = {
  sessions: {
    label: "방문",
    unit: "번",
    pick: (point: TrafficPoint) => point.sessions,
  },
  users: {
    label: "찾아온 사람",
    unit: "명",
    pick: (point: TrafficPoint) => point.activeUsers,
  },
  views: {
    label: "페이지 열람",
    unit: "회",
    pick: (point: TrafficPoint) => point.pageViews,
  },
} as const;

export type MetricKey = keyof typeof TRAFFIC_METRICS;

export function isMetricKey(value: unknown): value is MetricKey {
  return typeof value === "string" && value in TRAFFIC_METRICS;
}

export function TrafficChart({
  data,
  metric,
}: {
  data: TrafficPoint[];
  metric: MetricKey;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-500">데이터가 없습니다.</p>;
  }

  const { label, unit, pick } = TRAFFIC_METRICS[metric];
  const values = data.map(pick);
  const max = niceMax(Math.max(...values, 1));
  const baseline = PAD.top + PLOT_H;
  const x = (index: number) =>
    data.length > 1
      ? PAD.left + (index * PLOT_W) / (data.length - 1)
      : PAD.left + PLOT_W / 2;
  const y = (value: number) => baseline - (value / max) * PLOT_H;

  const line = values.map((value, i) => `${x(i)},${y(value)}`).join(" ");
  const area = `M ${x(0)},${baseline} L ${line.split(" ").join(" L ")} L ${x(data.length - 1)},${baseline} Z`;
  // 라벨이 겹치지 않도록 최대 7개까지만 날짜를 찍는다.
  const labelStep = Math.ceil(data.length / 7);
  const hitWidth = data.length > 1 ? PLOT_W / (data.length - 1) : PLOT_W;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      aria-label={`${label} 추이`}
      role="img"
    >
      {[0, 0.5, 1].map((ratio) => {
        const value = max * ratio;
        return (
          <g key={ratio}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(value)}
              y2={y(value)}
              className="stroke-gray-200"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(value) + 4}
              textAnchor="end"
              className="fill-gray-400 text-[11px] tabular-nums"
            >
              {value.toLocaleString("ko-KR")}
            </text>
          </g>
        );
      })}

      <path d={area} className="fill-primary" opacity={0.08} />
      <polyline
        points={line}
        fill="none"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-primary"
      />

      {data.map((point, i) =>
        i % labelStep === 0 ? (
          <text
            key={point.date}
            x={x(i)}
            y={H - 6}
            textAnchor="middle"
            className="fill-gray-400 text-[11px]"
          >
            {shortDate(point.date)}
          </text>
        ) : null,
      )}

      {/* 날짜별 hover 영역 — CSS만으로 값을 띄운다(클라이언트 JS 불필요). */}
      {data.map((point, i) => {
        const anchor =
          x(i) < PAD.left + 60
            ? "start"
            : x(i) > W - PAD.right - 60
              ? "end"
              : "middle";
        return (
          <g key={point.date} className="group">
            <rect
              x={x(i) - hitWidth / 2}
              y={PAD.top}
              width={hitWidth}
              height={PLOT_H}
              fill="transparent"
            />
            <line
              x1={x(i)}
              x2={x(i)}
              y1={PAD.top}
              y2={baseline}
              className="stroke-gray-300 opacity-0 group-hover:opacity-100"
              strokeWidth={1}
            />
            <circle
              cx={x(i)}
              cy={y(values[i])}
              r={4}
              className="fill-primary opacity-0 group-hover:opacity-100"
            />
            <text
              x={x(i)}
              y={PAD.top - 6}
              textAnchor={anchor}
              paintOrder="stroke"
              strokeWidth={4}
              strokeLinejoin="round"
              className="fill-gray-900 stroke-white text-[12px] font-semibold opacity-0 group-hover:opacity-100 dark:stroke-gray-100"
            >
              {shortDate(point.date)} · {values[i].toLocaleString("ko-KR")}
              {unit}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
