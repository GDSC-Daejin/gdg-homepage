import type { TrafficPoint } from "@/lib/ga4";

export function TrafficChart({ data }: { data: TrafficPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-500">데이터가 없습니다.</p>;
  }

  const width = 640;
  const height = 160;
  const maxSessions = Math.max(...data.map((point) => point.sessions), 1);
  const step = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data
    .map(
      (point, index) =>
        `${index * step},${height - (point.sessions / maxSessions) * height}`,
    )
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-40 w-full"
      preserveAspectRatio="none"
      aria-label="세션 트래픽 추이"
      role="img"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="text-primary"
        points={points}
      />
    </svg>
  );
}
