import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_SEASON } from "@/lib/constants";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import type { Application, ApplicationStatus, Profile } from "@/lib/types";
import { ReviewButtons } from "./ReviewButtons";
import { SeasonFilter } from "./SeasonFilter";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: "심사 중",
  accepted: "합격",
  rejected: "불합격",
};

const STATUS_TONE: Record<ApplicationStatus, "warning" | "success" | "danger"> = {
  pending: "warning",
  accepted: "success",
  rejected: "danger",
};

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "pending", label: "심사 중" },
  { value: "accepted", label: "합격" },
  { value: "rejected", label: "불합격" },
];

type ApplicantInfo = Pick<Profile, "id" | "name" | "student_no" | "major">;

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; status?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const status = params.status ?? "all";

  const supabase = await createClient();

  const { data: seasonRows } = await supabase
    .from("applications")
    .select("season")
    .order("season", { ascending: false });
  const seasons = Array.from(
    new Set(
      ((seasonRows as { season: string }[] | null) ?? []).map((row) => row.season),
    ),
  );
  const season = params.season ?? seasons[0] ?? CURRENT_SEASON;

  let query = supabase
    .from("applications")
    .select("*")
    .eq("season", season)
    .order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status", status);

  const { data: appData } = await query;
  const applications = (appData as Application[] | null) ?? [];

  const applicantIds = Array.from(new Set(applications.map((a) => a.applicant_id)));
  const { data: profileData } = applicantIds.length
    ? await supabase
        .from("profiles")
        .select("id, name, student_no, major")
        .in("id", applicantIds)
    : { data: [] as ApplicantInfo[] };
  const applicantMap = new Map(
    ((profileData as ApplicantInfo[] | null) ?? []).map((p) => [p.id, p]),
  );

  return (
    <div>
      <PageHeader title="지원서 심사" description={`${season} 시즌`} />
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex gap-2">
          {STATUS_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={`/admin/applications?season=${season}&status=${tab.value}`}
              className={
                status === tab.value
                  ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
              }
            >
              {tab.label}
            </Link>
          ))}
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
          description="선택한 조건에 해당하는 지원서가 없어요"
        />
      ) : (
        <div className="flex flex-col gap-4">
          {applications.map((app) => {
            const applicant = applicantMap.get(app.applicant_id);
            return (
              <Card key={app.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {applicant?.name ?? "알 수 없음"}
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        {applicant?.student_no} · {applicant?.major}
                      </span>
                    </p>
                    <Badge tone={STATUS_TONE[app.status]} className="mt-1">
                      {STATUS_LABEL[app.status]}
                    </Badge>
                  </div>
                  <ReviewButtons id={app.id} status={app.status} />
                </div>
                <dl className="mt-4 flex flex-col gap-3">
                  <div>
                    <dt className="text-xs font-medium text-gray-500">자기소개</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                      {app.answers.intro}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500">지원 동기</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                      {app.answers.motivation}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500">관심 분야</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                      {app.answers.interest}
                    </dd>
                  </div>
                </dl>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
