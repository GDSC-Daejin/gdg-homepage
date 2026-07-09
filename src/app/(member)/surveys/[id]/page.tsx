import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import type { Survey } from "@/lib/types";
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

  const { data: existing } = await supabase
    .from("survey_responses")
    .select("*")
    .eq("survey_id", id)
    .eq("user_id", profile.id)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={s.title} />
      <Card>
        {existing ? (
          <p className="text-sm text-gray-700">응답 완료 — 참여해주셔서 감사해요.</p>
        ) : !s.is_open ? (
          <p className="text-sm text-gray-700">마감된 설문이에요.</p>
        ) : (
          <SurveyResponseForm surveyId={s.id} questions={s.questions} />
        )}
      </Card>
    </div>
  );
}
