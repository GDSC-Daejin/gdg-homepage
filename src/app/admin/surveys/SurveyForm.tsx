"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSurvey } from "@/actions/survey";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/cn";
import type { Event, SurveyQuestion, SurveyQuestionType } from "@/lib/types";

interface SurveyFormProps {
  events: Pick<Event, "id" | "title">[];
}

const TYPE_LABEL: Record<SurveyQuestionType, string> = {
  rating: "평점",
  text: "서술",
};

const TYPE_BADGE: Record<SurveyQuestionType, string> = {
  rating: "bg-primary-soft text-primary",
  text: "bg-success-soft text-success",
};

function RequiredMark() {
  return <span className="text-danger">*</span>;
}

function OptionalMark({ children }: { children?: React.ReactNode }) {
  return <span className="font-normal text-gray-400">{children ?? "선택"}</span>;
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
    >
      <circle cx="12" cy="12" r="9" strokeOpacity={0.3} />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </svg>
  );
}

export function SurveyForm({ events }: SurveyFormProps) {
  const router = useRouter();
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function addQuestion(type: SurveyQuestionType) {
    setQuestions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type, label: "" },
    ]);
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  function updateLabel(id: string, label: string) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, label } : q)),
    );
  }

  function handleSubmit(formData: FormData) {
    setError(undefined);
    formData.set("questions", JSON.stringify(questions));
    startTransition(async () => {
      const result = await createSurvey(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/admin/surveys");
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <Input
        name="title"
        label={
          <>
            제목 <RequiredMark />
          </>
        }
        placeholder="예) 4주차 세션 만족도 조사"
        required
      />
      <div className="flex flex-col gap-1">
        <Select
          name="event_id"
          label={
            <>
              연결 이벤트 <OptionalMark />
            </>
          }
          defaultValue=""
        >
          <option value="">연결 안 함</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </Select>
        <p className="text-xs text-gray-400">
          특정 이벤트에 연결하면 결과를 이벤트 단위로 묶어 볼 수 있어요.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <span className="flex items-center justify-between text-sm font-medium text-gray-700">
          <span>
            질문 <RequiredMark />
          </span>
          <span className="text-xs font-normal text-gray-400">{questions.length}개</span>
        </span>

        {questions.length === 0 ? (
          <EmptyState
            title="아직 질문이 없어요"
            description="아래 버튼으로 평점 또는 서술 질문을 추가해주세요."
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
                <path d="M5 3.5A1.5 1.5 0 0 1 6.5 2h7A1.5 1.5 0 0 1 15 3.5v13a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 16.5v-13Z" />
                <path d="M7.75 7h4.5M7.75 10h4.5" />
                <path d="M7.6 13.2h.01l.9 1 1.1-1.6" />
              </svg>
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {questions.map((q, i) => (
              <div
                key={q.id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 dark:bg-gray-100"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                  {i + 1}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    TYPE_BADGE[q.type],
                  )}
                >
                  {TYPE_LABEL[q.type]}
                </span>
                <Input
                  className="flex-1"
                  placeholder="질문 내용"
                  value={q.label}
                  onChange={(e) => updateLabel(q.id, e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 border border-gray-300 px-2"
                  onClick={() => removeQuestion(q.id)}
                  aria-label="질문 삭제"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4.5 6h11M8.5 6V4.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V6M6 6l.6 9a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9L14 6" />
                  </svg>
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1 border border-dashed border-primary"
            onClick={() => addQuestion("rating")}
          >
            <span className="flex items-center gap-1.5">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M10 4v12M4 10h12" strokeLinecap="round" />
              </svg>
              평점 질문 추가
            </span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="flex-1 border border-gray-300"
            onClick={() => addQuestion("text")}
          >
            <span className="flex items-center gap-1.5">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M10 4v12M4 10h12" strokeLinecap="round" />
              </svg>
              서술 질문 추가
            </span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-danger bg-danger-soft px-3 py-2.5 text-sm text-danger">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            className="h-4 w-4 shrink-0"
          >
            <circle cx="10" cy="10" r="8" />
            <path d="M10 6v5M10 14h.01" strokeLinecap="round" />
          </svg>
          {error}
        </div>
      )}
      <Button
        type="submit"
        variant="primary"
        className="mt-2"
        disabled={pending}
      >
        {pending ? (
          <span className="flex items-center gap-2">
            <Spinner />
            생성 중...
          </span>
        ) : (
          "생성"
        )}
      </Button>
    </form>
  );
}
