import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import type { Survey } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PastResponseItem {
  survey: { id: string; title: string; is_open: boolean } | null;
}

export default async function SurveysPage() {
  const profile = await requireProfile();

  const supabase = await createClient();
  const [{ data: surveys }, { data: myResponses }] = await Promise.all([
    supabase
      .from("surveys")
      .select("*")
      .eq("is_open", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("survey_responses")
      .select("survey:surveys(id, title, is_open)")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .returns<PastResponseItem[]>(),
  ]);
  const list = (surveys ?? []) as Survey[];

  const respondedIds = new Set(
    (myResponses ?? [])
      .map((r) => r.survey?.id)
      .filter((v): v is string => !!v),
  );
  const pastClosed = (myResponses ?? [])
    .map((r) => r.survey)
    .filter((s): s is NonNullable<PastResponseItem["survey"]> => !!s && !s.is_open);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <PageHeader title="설문" description="참여 가능한 설문이에요" />
        {list.length === 0 ? (
          <EmptyState title="열린 설문이 없어요" />
        ) : (
          <div className="flex flex-col gap-3">
            {list.map((survey) => (
              <Link key={survey.id} href={`/surveys/${survey.id}`}>
                <Card className="flex items-center justify-between gap-4 transition-shadow hover:shadow-md">
                  <h2 className="min-w-0 truncate text-base font-semibold text-gray-900">
                    {survey.title}
                  </h2>
                  {respondedIds.has(survey.id) ? (
                    <Badge tone="neutral" className="shrink-0">응답 완료</Badge>
                  ) : (
                    <Badge tone="primary" className="shrink-0">미응답</Badge>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {pastClosed.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            내가 응답한 지난 설문
          </h2>
          <div className="flex flex-col gap-3">
            {pastClosed.map((survey) => (
              <Link key={survey.id} href={`/surveys/${survey.id}`}>
                <Card className="flex items-center justify-between gap-4 transition-shadow hover:shadow-md">
                  <h2 className="min-w-0 truncate text-base font-semibold text-gray-900">
                    {survey.title}
                  </h2>
                  <Badge tone="neutral" className="shrink-0">마감</Badge>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
