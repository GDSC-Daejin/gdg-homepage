import Link from "next/link";
import { Card } from "@/components/Card";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/Badge";
import { formatKstTime } from "@/lib/format";
import { POSITION_LABELS } from "@/lib/types";

interface RecruitingWidgetCounts {
  total: number;
  waiting: number;
  pending: number;
  decided: number;
  frontend: number;
  backend: number;
  designer: number;
  unassigned: number;
}

interface TodayEvent {
  id: string;
  title: string;
  starts_at: string;
}

interface RecruitingWidgetProps {
  season: string;
  counts: RecruitingWidgetCounts;
  todayEvents: TodayEvent[];
}

const quickActions = [
  {
    href: "/admin/applications",
    label: "지원자 관리",
    d: "M4 7a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z",
  },
  {
    href: "/admin/notices/new",
    label: "공지 작성",
    d: "M4 11v2a1 1 0 0 0 1 1h2l7 4V6l-7 4H5a1 1 0 0 0-1 1Zm14-3a4 4 0 0 1 0 6",
  },
  {
    href: "/admin/events/new",
    label: "이벤트 생성",
    d: "M8 3v3M16 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
  },
];

export function RecruitingWidget({ season, counts, todayEvents }: RecruitingWidgetProps) {
  const positionBreakdown = [
    { label: POSITION_LABELS.frontend, count: counts.frontend },
    { label: POSITION_LABELS.backend, count: counts.backend },
    { label: POSITION_LABELS.designer, count: counts.designer },
    { label: "미지정", count: counts.unassigned },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900">리크루팅</p>
          <Badge tone="neutral">{season}</Badge>
          <Badge tone="success">모집 중</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/admin/applications?season=${season}&status=all`} className="transition hover:opacity-80">
            <StatCard label="전체 지원자" value={counts.total} />
          </Link>
          <Link href={`/admin/applications?season=${season}&status=waiting`} className="transition hover:opacity-80">
            <StatCard label="심사 대기" value={counts.waiting} />
          </Link>
          <Link href={`/admin/applications?season=${season}&status=pending`} className="transition hover:opacity-80">
            <StatCard label="심사 중" value={counts.pending} />
          </Link>
          <Link href={`/admin/applications?season=${season}&status=accepted`} className="transition hover:opacity-80">
            <StatCard label="합격·불합격" value={counts.decided} />
          </Link>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          {positionBreakdown.map((p) => `${p.label} ${p.count}`).join(" · ")}
        </p>
      </Card>

      <Card>
        <p className="mb-3 text-sm font-semibold text-gray-900">오늘 일정</p>
        {todayEvents.length === 0 ? (
          <p className="text-sm text-gray-500">오늘 일정이 없어요</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {todayEvents.map((event) => (
              <li key={event.id} className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-900">{event.title}</span>
                <span className="text-gray-500">{formatKstTime(event.starts_at)}</span>
              </li>
            ))}
          </ul>
        )}

        {counts.waiting > 0 && (
          <Link
            href={`/admin/applications?season=${season}&status=waiting`}
            className="mt-4 flex items-center justify-between rounded-lg bg-warning-soft px-4 py-3 text-sm font-medium text-warning transition hover:opacity-80"
          >
            심사 대기 {counts.waiting}건
            <span aria-hidden>→</span>
          </Link>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-200 pt-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d={action.d} />
              </svg>
              {action.label}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
