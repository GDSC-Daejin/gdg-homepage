import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/cn";
import type { Survey, SurveyResponse } from "@/lib/types";
import { isDemoMode } from "@/lib/demo";
import { DEMO_SURVEYS, DEMO_SURVEY_RESPONSES } from "@/lib/demoData";

export const dynamic = "force-dynamic";

function Stars({ score }: { score: number }) {
  const filled = Math.round(score);
  return (
    <span className="text-lg leading-none text-warning" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i}>{i <= filled ? "★" : "☆"}</span>
      ))}
    </span>
  );
}

function barTone(score: number) {
  if (score <= 2) return "bg-danger";
  if (score === 3) return "bg-warning";
  return "bg-success";
}

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

  const ratingQuestions = s.questions.filter((q) => q.type === "rating");
  const allRatingValues = ratingQuestions.flatMap((q) =>
    list
      .map((r) => Number(r.answers[q.id]))
      .filter((n) => !Number.isNaN(n)),
  );
  const overallAvg = allRatingValues.length
    ? allRatingValues.reduce((a, b) => a + b, 0) / allRatingValues.length
    : 0;

  const positiveCount = allRatingValues.filter((n) => n >= 4).length;
  const neutralCount = allRatingValues.filter((n) => n === 3).length;
  const negativeCount = allRatingValues.filter((n) => n <= 2).length;
  const positiveRate = allRatingValues.length
    ? (positiveCount / allRatingValues.length) * 100
    : null;
  const neutralRate = allRatingValues.length
    ? (neutralCount / allRatingValues.length) * 100
    : 0;
  const negativeRate = allRatingValues.length
    ? (negativeCount / allRatingValues.length) * 100
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/surveys"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 15 7 10l5-5" />
          </svg>
          설문 목록
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <Badge tone={s.is_open ? "success" : "neutral"}>
            {s.is_open ? "열림" : "닫힘"}
          </Badge>
          <h1 className="text-2xl font-bold text-gray-900">{s.title}</h1>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          응답 {list.length}건 · 질문 {s.questions.length}개
        </p>
      </div>

      <hr className="border-gray-200" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="총 응답" value={`${list.length}건`} />
        <StatCard
          label="평균 만족도"
          value={
            allRatingValues.length ? (
              <span className="inline-flex items-baseline gap-1.5">
                <span>{overallAvg.toFixed(1)} / 5</span>
                <Stars score={overallAvg} />
              </span>
            ) : (
              "-"
            )
          }
          hint={ratingQuestions.length ? `${allRatingValues.length}개 응답 기준` : undefined}
        />
        {positiveRate !== null && (
          <StatCard
            label="긍정 응답률"
            value={<span className="text-success">{positiveRate.toFixed(0)}%</span>}
            hint="4~5점 비율"
          />
        )}
      </div>

      {allRatingValues.length > 0 && (
        <Card>
          <div className="flex items-center justify-between gap-2">
            <p className="text-base font-semibold text-gray-900">전체 평점 응답 분포</p>
            <p className="text-xs text-gray-400">
              평점 질문 {ratingQuestions.length}개 · {allRatingValues.length}개 응답 기준
            </p>
          </div>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-gray-100">
            {positiveCount > 0 && (
              <div className="bg-success" style={{ width: `${positiveRate}%` }} />
            )}
            {neutralCount > 0 && (
              <div className="bg-warning" style={{ width: `${neutralRate}%` }} />
            )}
            {negativeCount > 0 && (
              <div className="bg-danger" style={{ width: `${negativeRate}%` }} />
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="h-2 w-2 shrink-0 rounded-full bg-success" />
              긍정 (4~5점){" "}
              <strong className="font-semibold text-gray-700">
                {positiveRate!.toFixed(0)}%
              </strong>{" "}
              · {positiveCount}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="h-2 w-2 shrink-0 rounded-full bg-warning" />
              중립 (3점){" "}
              <strong className="font-semibold text-gray-700">
                {neutralRate.toFixed(0)}%
              </strong>{" "}
              · {neutralCount}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="h-2 w-2 shrink-0 rounded-full bg-danger" />
              부정 (1~2점){" "}
              <strong className="font-semibold text-gray-700">
                {negativeRate.toFixed(0)}%
              </strong>{" "}
              · {negativeCount}
            </span>
          </div>
        </Card>
      )}

      {s.questions.length === 0 ? (
        <EmptyState title="질문이 없어요" />
      ) : (
        <div className="flex flex-col gap-4">
          {s.questions.map((q, index) => {
            const values = list
              .map((r) => r.answers[q.id])
              .filter((v) => v !== undefined && v !== "");

            return (
              <Card key={q.id}>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                    {index + 1}
                  </span>
                  <Badge tone={q.type === "rating" ? "primary" : "neutral"}>
                    {q.type === "rating" ? "평점" : "서술"}
                  </Badge>
                </div>
                <p className="mt-2 text-base font-semibold text-gray-900">{q.label}</p>

                {values.length === 0 ? (
                  <p className="mt-3 text-sm text-gray-500">응답 없음</p>
                ) : q.type === "rating" ? (
                  (() => {
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
                      <div>
                        <div className="mt-3 flex items-center gap-2">
                          <Stars score={avg} />
                          <span className="text-lg font-bold text-gray-900">
                            {avg.toFixed(1)}
                          </span>
                          <span className="text-sm text-gray-500">
                            ({nums.length}명 응답)
                          </span>
                        </div>
                        <div className="mt-3 flex flex-col gap-1.5">
                          {dist.map((count, i) => {
                            const score = i + 1;
                            const pct = nums.length ? (count / nums.length) * 100 : 0;
                            return (
                              <div key={score} className="flex items-center gap-2">
                                <span className="w-3 shrink-0 text-xs text-gray-500">
                                  {score}
                                </span>
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                                  <div
                                    className={cn(
                                      "h-full rounded-full",
                                      barTone(score),
                                    )}
                                    style={{ width: `${(count / max) * 100}%` }}
                                  />
                                </div>
                                <span className="w-20 shrink-0 text-right text-xs text-gray-500">
                                  {count}명 ({pct.toFixed(0)}%)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div>
                    <p className="mt-3 text-sm text-gray-500">{values.length}명 응답</p>
                    <div className="mt-3 flex flex-col gap-2">
                      {values.slice(0, 4).map((v, i) => (
                        <p
                          key={i}
                          className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-700"
                        >
                          {String(v)}
                        </p>
                      ))}
                    </div>
                    {values.length > 4 && (
                      <details className="mt-2">
                        <summary className="flex list-none cursor-pointer items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
                          나머지 응답 {values.length - 4}개 더보기
                        </summary>
                        <div className="mt-2 flex flex-col gap-2">
                          {values.slice(4).map((v, i) => (
                            <p
                              key={i}
                              className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-700"
                            >
                              {String(v)}
                            </p>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
