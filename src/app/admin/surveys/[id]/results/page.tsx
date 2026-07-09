import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import type { Survey, SurveyResponse } from "@/lib/types";
import { isDemoMode } from "@/lib/demo";
import { DEMO_SURVEYS, DEMO_SURVEY_RESPONSES } from "@/lib/demoData";

export const dynamic = "force-dynamic";

export default async function SurveyResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const demo = await isDemoMode();

  let s: Survey | undefined;
  let list: SurveyResponse[] = [];

  if (demo) {
    s = DEMO_SURVEYS.find((survey) => survey.id === id) ?? DEMO_SURVEYS[0];
    list = DEMO_SURVEY_RESPONSES[s.id] ?? [];
  } else {
    const supabase = await createClient();
    const { data: survey } = await supabase
      .from("surveys")
      .select("*")
      .eq("id", id)
      .single();

    if (!survey) notFound();
    s = survey as Survey;

    const { data: responses } = await supabase
      .from("survey_responses")
      .select("*")
      .eq("survey_id", id);
    list = (responses ?? []) as SurveyResponse[];
  }

  if (!s) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={s.title} description={`응답 ${list.length}건`} />
      {s.questions.length === 0 ? (
        <EmptyState title="질문이 없어요" />
      ) : (
        <div className="flex flex-col gap-4">
          {s.questions.map((q) => {
            const values = list
              .map((r) => r.answers[q.id])
              .filter((v) => v !== undefined && v !== "");

            if (q.type === "rating") {
              const nums = values
                .map((v) => Number(v))
                .filter((n) => !Number.isNaN(n));
              const avg = nums.length
                ? nums.reduce((a, b) => a + b, 0) / nums.length
                : 0;
              const dist = [1, 2, 3, 4, 5].map(
                (score) => nums.filter((n) => n === score).length,
              );
              const max = Math.max(1, ...dist);

              return (
                <Card key={q.id}>
                  <p className="text-sm font-semibold text-gray-900">{q.label}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    평균 {nums.length ? avg.toFixed(1) : "-"}점 ({nums.length}명 응답)
                  </p>
                  <div className="mt-3 flex flex-col gap-1.5">
                    {dist.map((count, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-3 shrink-0 text-xs text-gray-500">
                          {i + 1}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${(count / max) * 100}%` }}
                          />
                        </div>
                        <span className="w-6 shrink-0 text-right text-xs text-gray-500">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            }

            return (
              <Card key={q.id}>
                <p className="text-sm font-semibold text-gray-900">{q.label}</p>
                {values.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">응답 없음</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {values.map((v, i) => (
                      <li
                        key={i}
                        className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700"
                      >
                        {String(v)}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
