"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSurvey } from "@/actions/survey";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import type { Event, SurveyQuestion, SurveyQuestionType } from "@/lib/types";

interface SurveyFormProps {
  events: Pick<Event, "id" | "title">[];
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
      <Input name="title" label="제목" required />
      <Select name="event_id" label="이벤트 연결 (선택)" defaultValue="">
        <option value="">연결 안 함</option>
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title}
          </option>
        ))}
      </Select>

      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium text-gray-700">질문</span>
        {questions.map((q, i) => (
          <div key={q.id} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-xs text-gray-400">
              {i + 1}
            </span>
            <span className="w-12 shrink-0 text-xs text-gray-500">
              {q.type === "rating" ? "평점" : "서술"}
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
              onClick={() => removeQuestion(q.id)}
            >
              삭제
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => addQuestion("rating")}
          >
            평점 질문 추가
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => addQuestion("text")}
          >
            서술 질문 추가
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
      <Button
        type="submit"
        variant="primary"
        className="mt-2"
        disabled={pending}
      >
        생성
      </Button>
    </form>
  );
}
