import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import type { Survey } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SurveysPage() {
  const profile = await requireProfile();

  const supabase = await createClient();
  const { data: surveys } = await supabase
    .from("surveys")
    .select("*")
    .eq("is_open", true)
    .order("created_at", { ascending: false });
  const list = (surveys ?? []) as Survey[];

  const respondedIds = new Set<string>();
  if (list.length > 0) {
    const { data: responses } = await supabase
      .from("survey_responses")
      .select("survey_id")
      .eq("user_id", profile.id)
      .in(
        "survey_id",
        list.map((s) => s.id),
      );
    for (const r of responses ?? []) respondedIds.add(r.survey_id);
  }

  return (
    <div>
      <PageHeader title="설문" description="참여 가능한 설문이에요" />
      {list.length === 0 ? (
        <EmptyState title="열린 설문이 없어요" />
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((survey) => (
            <Link key={survey.id} href={`/surveys/${survey.id}`}>
              <Card className="flex items-center justify-between gap-4 transition-shadow hover:shadow-md">
                <h2 className="text-base font-semibold text-gray-900">
                  {survey.title}
                </h2>
                {respondedIds.has(survey.id) ? (
                  <Badge tone="neutral">응답 완료</Badge>
                ) : (
                  <Badge tone="primary">미응답</Badge>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
