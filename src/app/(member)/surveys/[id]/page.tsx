import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import type { Survey, SurveyResponse } from "@/lib/types";
import { SurveyResponseForm } from "./SurveyResponseForm";

export const dynamic = "force-dynamic";

export default async function SurveyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;

  const supabase = await createClient();
  const { data: survey } = await supabase
    .from("surveys")
    .select("*")
    .eq("id", id)
    .single();

  if (!survey) notFound();
  const s = survey as Survey;

  const { data: existingData } = await supabase
    .from("survey_responses")
    .select("*")
    .eq("survey_id", id)
    .eq("user_id", profile.id)
    .maybeSingle();
  const existing = existingData as SurveyResponse | null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={s.title} />

      {existing && s.is_open && (
        <div className="rounded-md bg-primary-soft px-4 py-2.5 text-sm text-primary">
          이미 응답했어요. 아래에서 내용을 수정할 수 있어요.
        </div>
      )}

      <Card>
        {existing && !s.is_open ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <Badge tone="neutral">마감된 설문</Badge>
              <span className="text-sm text-gray-500">내 응답</span>
            </div>
            {s.questions.map((q) => {
              const answer = existing.answers[q.id];
              return (
                <div key={q.id} className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-700">
                    {q.label}
                  </span>
                  <p className="whitespace-pre-wrap text-sm text-gray-900">
                    {answer == null || answer === ""
                      ? "무응답"
                      : q.type === "rating"
                        ? `${answer} / 5`
                        : String(answer)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : !existing && !s.is_open ? (
          <p className="text-sm text-gray-700">마감된 설문이에요.</p>
        ) : (
          <SurveyResponseForm
            surveyId={s.id}
            questions={s.questions}
            initialAnswers={existing?.answers}
          />
        )}
      </Card>
    </div>
  );
}
