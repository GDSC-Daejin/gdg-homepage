import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_SEASON } from "@/lib/constants";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import type { Application, ApplicationStatus } from "@/lib/types";
import { ApplicationCard } from "./ApplicationCard";
import { SeasonFilter } from "./SeasonFilter";
import { isDemoMode } from "@/lib/demo";
import { DEMO_APPLICATION_SEASONS, DEMO_APPLICATIONS } from "@/lib/demoData";

export const dynamic = "force-dynamic";

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "pending", label: "심사 중" },
  { value: "accepted", label: "합격" },
  { value: "rejected", label: "불합격" },
];

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; status?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const status = params.status ?? "all";
  const demo = await isDemoMode();

  let seasons: string[] = DEMO_APPLICATION_SEASONS;
  let season = params.season ?? seasons[0] ?? CURRENT_SEASON;
  let seasonApplications: Application[] = DEMO_APPLICATIONS.filter(
    (a) => a.season === season,
  );

  if (!demo) {
    const supabase = await createClient();

    const { data: seasonRows } = await supabase
      .from("applications")
      .select("season")
      .order("season", { ascending: false });
    seasons = Array.from(
      new Set(
        ((seasonRows as { season: string }[] | null) ?? []).map((row) => row.season),
      ),
    );
    season = params.season ?? seasons[0] ?? CURRENT_SEASON;

    const { data: appData } = await supabase
      .from("applications")
      .select("*")
      .eq("season", season)
      .order("created_at", { ascending: false });
    seasonApplications = (appData as Application[] | null) ?? [];
  }

  const statusCounts: Record<"all" | ApplicationStatus, number> = {
    all: seasonApplications.length,
    pending: seasonApplications.filter((a) => a.status === "pending").length,
    accepted: seasonApplications.filter((a) => a.status === "accepted").length,
    rejected: seasonApplications.filter((a) => a.status === "rejected").length,
  };
  const applications =
    status === "all"
      ? seasonApplications
      : seasonApplications.filter((a) => a.status === status);

  const isDecidedView = status === "accepted" || status === "rejected";

  return (
    <div>
      <PageHeader
        title="지원서 심사"
        description={`${season} 리크루팅 · 지원자의 답변을 읽고 합격/불합격을 결정해요`}
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-500">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <circle cx="10" cy="10" r="7.5" />
              <circle cx="10" cy="10" r="2.5" />
            </svg>
            GDG DJU 운영진 · 시즌별 지원서 심사
          </span>
        }
      />
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex gap-2">
          {STATUS_TABS.map((tab) => {
            const active = status === tab.value;
            return (
              <Link
                key={tab.value}
                href={`/admin/applications?season=${season}&status=${tab.value}`}
                className={
                  active
                    ? "inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
                    : "inline-flex items-center gap-2 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
                }
              >
                {tab.label}
                <span
                  className={
                    active
                      ? "rounded-full bg-white/20 px-1.5 py-0.5 text-xs font-semibold leading-none"
                      : "rounded-full bg-white px-1.5 py-0.5 text-xs font-semibold leading-none text-gray-500"
                  }
                >
                  {statusCounts[tab.value as "all" | ApplicationStatus]}
                </span>
              </Link>
            );
          })}
        </div>
        <SeasonFilter
          seasons={seasons.length ? seasons : [CURRENT_SEASON]}
          value={season}
          status={status}
        />
      </div>

      {applications.length === 0 ? (
        <EmptyState
          title="지원서가 없어요"
          description="선택한 조건에 해당하는 지원서가 없어요. 다른 상태 탭이나 시즌을 확인해 보세요."
          icon={
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <path d="M3.5 6.5 10 3l6.5 3.5v9L10 19l-6.5-3.5v-9Z" />
              <path d="M3.5 6.5 10 10l6.5-3.5M10 10v9" />
            </svg>
          }
        />
      ) : (
        <div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {applications.map((app) => (
              <ApplicationCard key={app.id} application={app} />
            ))}
          </div>
          {isDecidedView && (
            <p className="mt-4 text-sm text-gray-500">
              한 번 심사한 지원서는 다시 심사할 수 없어요
            </p>
          )}
        </div>
      )}
    </div>
  );
}
