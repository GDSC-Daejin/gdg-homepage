import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { ToggleSurveyButton } from "./ToggleSurveyButton";
import { DeleteSurveyButton } from "./DeleteSurveyButton";
import type { Survey } from "@/lib/types";
import { isDemoMode } from "@/lib/demo";
import { DEMO_SURVEYS, DEMO_SURVEY_RESPONSE_COUNTS } from "@/lib/demoData";

export const dynamic = "force-dynamic";

export default async function AdminSurveysPage() {
  const demo = await isDemoMode();
  let list: Survey[] = DEMO_SURVEYS;
  const counts: Record<string, number> = demo ? { ...DEMO_SURVEY_RESPONSE_COUNTS } : {};

  if (!demo) {
    const supabase = await createClient();
    const { data: surveys } = await supabase
      .from("surveys")
      .select("*")
      .order("created_at", { ascending: false });
    list = (surveys ?? []) as Survey[];

    if (list.length > 0) {
      const { data: responseRows } = await supabase
        .from("survey_responses")
        .select("survey_id")
        .in(
          "survey_id",
          list.map((s) => s.id),
        );
      for (const row of responseRows ?? []) {
        counts[row.survey_id] = (counts[row.survey_id] ?? 0) + 1;
      }
    }
  }

  return (
    <div>
      <PageHeader
        title="설문"
        description="설문을 생성하고 응답 결과를 확인해요"
        action={
          <Link href="/admin/surveys/new">
            <Button type="button" variant="primary">
              설문 생성
            </Button>
          </Link>
        }
      />
      {list.length === 0 ? (
        <EmptyState title="등록된 설문이 없어요" />
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((survey) => (
            <Card key={survey.id} className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone={survey.is_open ? "success" : "neutral"}>
                    {survey.is_open ? "열림" : "닫힘"}
                  </Badge>
                  <Link
                    href={`/admin/surveys/${survey.id}/results`}
                    className="text-base font-semibold text-gray-900 hover:underline"
                  >
                    {survey.title}
                  </Link>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  응답 {counts[survey.id] ?? 0}건
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ToggleSurveyButton surveyId={survey.id} isOpen={survey.is_open} />
                <DeleteSurveyButton surveyId={survey.id} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
