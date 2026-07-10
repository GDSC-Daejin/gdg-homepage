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
import { formatKstDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function PlusIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0 text-gray-400"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 13 13 7M7 7h6v6" />
    </svg>
  );
}

function ResponseIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 5.5h12a1 1 0 0 1 1 1V13a1 1 0 0 1-1 1H8l-3 2.5V14H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

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
            <Button type="button" variant="primary" className="gap-1.5">
              <PlusIcon />
              설문 생성
            </Button>
          </Link>
        }
      />
      {list.length === 0 ? (
        <EmptyState
          title="등록된 설문이 없어요"
          description="첫 설문을 만들어 참가자들의 피드백을 받아보세요."
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
              <path d="M7 2.5h6a1 1 0 0 1 1 1V4h.5A1.5 1.5 0 0 1 16 5.5v11A1.5 1.5 0 0 1 14.5 18h-9A1.5 1.5 0 0 1 4 16.5v-11A1.5 1.5 0 0 1 5.5 4H6v-.5a1 1 0 0 1 1-1Z" />
              <path d="M7.5 4.5h5" />
              <path d="M7 9.5 8.25 10.75 10.5 8.25M12 9.5h1.5" />
              <path d="M7 13.5 8.25 14.75 10.5 12.25M12 13.5h1.5" />
            </svg>
          }
          action={
            <Link href="/admin/surveys/new">
              <Button type="button" variant="primary" className="gap-1.5">
                <PlusIcon />
                설문 생성
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {list.map((survey) => {
            const responseCount = counts[survey.id] ?? 0;
            return (
              <Card key={survey.id} className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={survey.is_open ? "success" : "neutral"}
                      solid={survey.is_open}
                      className="gap-1"
                    >
                      {!survey.is_open && <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />}
                      {survey.is_open ? "열림" : "닫힘"}
                    </Badge>
                    <Link
                      href={`/admin/surveys/${survey.id}/results`}
                      className="inline-flex items-center gap-1 text-base font-semibold text-gray-900 hover:underline"
                    >
                      {survey.title}
                      <ExternalLinkIcon />
                    </Link>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                    <ResponseIcon />
                    응답 {responseCount}건 · {formatKstDate(survey.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ToggleSurveyButton surveyId={survey.id} isOpen={survey.is_open} />
                  <DeleteSurveyButton surveyId={survey.id} responseCount={responseCount} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
