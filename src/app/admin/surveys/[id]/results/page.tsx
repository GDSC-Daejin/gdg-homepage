import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/cn";
import { paginateSurveyAnswers } from "@/lib/survey-results";
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

function ScoreCells({ counts, total }: { counts: number[]; total: number }) {
  return (
    <div className="grid grid-cols-5 overflow-hidden rounded-lg border border-gray-200">
      {counts.map((count, index) => {
        const score = index + 1;
        const percentage = total ? (count / total) * 100 : 0;
        const tone =
          count === 0
            ? "bg-white text-gray-400 dark:bg-gray-100"
            : score >= 4
              ? "bg-success-soft text-success"
              : score === 3
                ? "bg-warning-soft text-warning"
                : "bg-danger-soft text-danger";

        return (
          <div
            key={score}
            className={cn(
              "flex min-w-0 flex-col items-center px-2 py-3 text-center",
              index > 0 && "border-l border-gray-200",
              tone,
            )}
          >
            <span className="text-xs font-medium text-gray-700">{score}점</span>
            <strong className="mt-1 text-xl font-bold tracking-tight">
              {percentage.toFixed(0)}%
            </strong>
            <span className="mt-0.5 text-xs text-gray-500">{count}명</span>
          </div>
        );
      })}
    </div>
  );
}

export default async function SurveyResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ id }, { page }] = await Promise.all([params, searchParams]);
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

  const overallDist = [1, 2, 3, 4, 5].map(
    (score) => allRatingValues.filter((n) => n === score).length,
  );
  const positiveCount = overallDist[3] + overallDist[4];
  const positiveRate = allRatingValues.length
    ? (positiveCount / allRatingValues.length) * 100
    : null;

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
            {s.is_open ? "게시됨" : "닫힘"}
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{s.title}</h1>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          응답 {list.length}건 · 질문 {s.questions.length}개
        </p>
      </div>

      <hr className="border-gray-200" />

      <Card className="!p-0">
        <div className="grid grid-cols-1 divide-y divide-gray-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="p-5">
            <p className="text-sm text-gray-500">평균 만족도</p>
            <div className="mt-2 flex items-baseline gap-2">
              <strong className="text-3xl font-bold tracking-tight text-gray-900">
                {allRatingValues.length ? overallAvg.toFixed(1) : "-"}
              </strong>
              {allRatingValues.length > 0 && <span className="text-lg text-gray-500">/ 5</span>}
            </div>
            {allRatingValues.length > 0 && <div className="mt-2"><Stars score={overallAvg} /></div>}
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-500">응답 수</p>
            <strong className="mt-2 block text-3xl font-bold tracking-tight text-gray-900">
              {list.length}건
            </strong>
            <p className="mt-2 text-xs text-gray-400">전체 응답</p>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-500">긍정 응답률 (4~5점)</p>
            <strong className="mt-2 block text-3xl font-bold tracking-tight text-success">
              {positiveRate === null ? "-" : `${positiveRate.toFixed(0)}%`}
            </strong>
            <p className="mt-2 text-xs text-gray-400">
              {allRatingValues.length ? `${positiveCount}개 응답` : "평점 응답 없음"}
            </p>
          </div>
        </div>
      </Card>

      {allRatingValues.length > 0 && (
        <Card>
          <div className="flex items-center justify-between gap-2">
            <p className="text-base font-semibold text-gray-900">평점 분포</p>
            <p className="text-xs text-gray-400">
              평점 질문 {ratingQuestions.length}개 · {allRatingValues.length}개 응답 기준
            </p>
          </div>
          <div className="mt-3"><ScoreCells counts={overallDist} total={allRatingValues.length} /></div>
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
              <Card key={q.id} id={`question-${index + 1}`}>
                <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                  <span>질문 {index + 1}</span>
                  <span aria-hidden>·</span>
                  <Badge tone={q.type === "rating" ? "primary" : "neutral"}>
                    {q.type === "rating" ? "평점" : "서술"}
                  </Badge>
                </div>
                <p className="mt-1.5 text-lg font-semibold text-gray-900">{q.label}</p>

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
                        <div className="mt-3"><ScoreCells counts={dist} total={nums.length} /></div>
                      </div>
                    );
                  })()
                ) : (
                  (() => {
                    const answers = values.map(String);
                    const pagination = paginateSurveyAnswers(answers, Number(page));
                    const firstPage = Math.max(
                      1,
                      Math.min(pagination.page - 2, pagination.totalPages - 4),
                    );
                    const pageNumbers = Array.from(
                      { length: Math.min(5, pagination.totalPages) },
                      (_, pageIndex) => firstPage + pageIndex,
                    );
                    const hrefForPage = (targetPage: number) =>
                      `/admin/surveys/${id}/results?page=${targetPage}#question-${index + 1}`;

                    return (
                      <div>
                        <p className="mt-3 text-sm text-gray-500">
                          서술형 응답 <strong className="font-semibold text-success">{answers.length}개</strong>
                        </p>
                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                          {pagination.items.map((answer, answerIndex) => (
                            <details
                              key={pagination.startIndex + answerIndex}
                              className="group border-b border-gray-200 last:border-b-0"
                            >
                              <summary className="flex list-none cursor-pointer items-start gap-3 px-4 py-3 hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
                                <span className="pt-0.5 text-sm font-bold text-success">
                                  {String(pagination.startIndex + answerIndex + 1).padStart(2, "0")}
                                </span>
                                <span className="max-h-10 min-w-0 flex-1 overflow-hidden text-sm leading-5 text-gray-700">
                                  {answer}
                                </span>
                                <span className="shrink-0 text-xs font-medium text-gray-500 group-open:hidden">
                                  전문 보기
                                </span>
                                <span className="hidden shrink-0 text-xs font-medium text-success group-open:inline">
                                  접기
                                </span>
                              </summary>
                              <p className="mx-4 mb-3 ml-11 whitespace-pre-wrap rounded-md bg-gray-50 px-3 py-2.5 text-sm leading-6 text-gray-700">
                                {answer}
                              </p>
                            </details>
                          ))}
                        </div>
                        {pagination.totalPages > 1 && (
                          <nav
                            aria-label={`${q.label} 응답 페이지`}
                            className="mt-3 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-1">
                              {pagination.page > 1 ? (
                                <Link
                                  href={hrefForPage(pagination.page - 1)}
                                  aria-label="이전 응답 페이지"
                                  className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
                                >
                                  ←
                                </Link>
                              ) : (
                                <span
                                  aria-disabled="true"
                                  className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-300"
                                >
                                  ←
                                </span>
                              )}
                              {pageNumbers.map((pageNumber) => (
                                <Link
                                  key={pageNumber}
                                  href={hrefForPage(pageNumber)}
                                  aria-current={pagination.page === pageNumber ? "page" : undefined}
                                  className={cn(
                                    "flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm font-medium",
                                    pagination.page === pageNumber
                                      ? "border-success bg-success text-white"
                                      : "border-gray-200 text-gray-600 hover:bg-gray-50",
                                  )}
                                >
                                  {pageNumber}
                                </Link>
                              ))}
                              {pagination.page < pagination.totalPages ? (
                                <Link
                                  href={hrefForPage(pagination.page + 1)}
                                  aria-label="다음 응답 페이지"
                                  className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
                                >
                                  →
                                </Link>
                              ) : (
                                <span
                                  aria-disabled="true"
                                  className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-300"
                                >
                                  →
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              {pagination.startIndex + 1}–
                              {Math.min(pagination.startIndex + pagination.items.length, answers.length)} / {answers.length}
                            </p>
                          </nav>
                        )}
                      </div>
                    );
                  })()
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
