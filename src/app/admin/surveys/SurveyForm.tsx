"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSurvey, editSurvey, createSurveyPreset } from "@/actions/survey";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/cn";
import type {
  Event,
  Survey,
  SurveyPreset,
  SurveyQuestion,
  SurveyQuestionType,
} from "@/lib/types";

interface SurveyFormProps {
  events: Pick<Event, "id" | "title">[];
  presets: SurveyPreset[];
  survey?: Pick<Survey, "id" | "title" | "event_id" | "questions" | "audience">;
}

const TYPE_LABEL: Record<SurveyQuestionType, string> = {
  rating: "평점",
  text: "서술",
};

const TYPE_BADGE: Record<SurveyQuestionType, string> = {
  rating: "bg-primary-soft text-primary",
  text: "bg-success-soft text-success",
};

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

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

export function SurveyForm({ events, presets: initialPresets, survey }: SurveyFormProps) {
  const router = useRouter();
  const isEdit = !!survey;
  const [questions, setQuestions] = useState<SurveyQuestion[]>(survey?.questions ?? []);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  // ponytail: 네이티브 HTML5 DnD — dnd 라이브러리 없이 목록 정렬만 하면 충분
  const [dragIndex, setDragIndex] = useState<number>();
  const [overIndex, setOverIndex] = useState<number>();
  const [dragId, setDragId] = useState<string>();

  const [presets, setPresets] = useState<SurveyPreset[]>(initialPresets);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetName, setPresetName] = useState("");
  const [presetMsg, setPresetMsg] = useState<{ text: string; error: boolean }>();
  const [presetSaving, startPresetSave] = useTransition();

  function addQuestion(type: SurveyQuestionType) {
    setQuestions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type, label: "" },
    ]);
  }

  function moveQuestion(from: number, to: number) {
    setQuestions((prev) => moveItem(prev, from, to));
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  function updateLabel(id: string, label: string) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, label } : q)),
    );
  }

  function loadPreset() {
    const preset = presets.find((p) => p.id === selectedPresetId);
    if (!preset) return;
    setQuestions((prev) => [
      ...prev,
      ...preset.questions.map((q) => ({ ...q, id: crypto.randomUUID() })),
    ]);
    setPresetMsg({ text: `'${preset.name}' 질문을 추가했어요`, error: false });
  }

  function savePreset() {
    setPresetMsg(undefined);
    const formData = new FormData();
    formData.set("name", presetName.trim());
    formData.set("questions", JSON.stringify(questions));
    startPresetSave(async () => {
      const result = await createSurveyPreset(formData);
      if (result.error) {
        setPresetMsg({ text: result.error, error: true });
        return;
      }
      if (result.preset) {
        setPresets((prev) => [result.preset!, ...prev]);
        setPresetName("");
        setPresetMsg({ text: "프리셋으로 저장했어요", error: false });
      }
    });
  }

  function handleSubmit(formData: FormData) {
    setError(undefined);
    formData.set("questions", JSON.stringify(questions));
    startTransition(async () => {
      const result = survey
        ? await editSurvey(survey.id, formData)
        : await createSurvey(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/admin/surveys");
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <section className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-900">기본 정보</h2>
          <p className="mt-1 text-xs text-gray-500">응답자가 알아볼 수 있는 제목을 입력해주세요.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <Input
              name="title"
              label={
                <>
                  제목 <RequiredMark />
                </>
              }
              placeholder="예) 4주차 세션 만족도 조사"
              defaultValue={survey?.title}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Select
              name="event_id"
              label={
                <>
                  연결 이벤트 <OptionalMark />
                </>
              }
              defaultValue={survey?.event_id ?? ""}
            >
              <option value="">연결 안 함</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </Select>
            <p className="text-xs text-gray-400">이벤트별로 결과를 묶어 볼 수 있어요.</p>
          </div>
          <div className="flex flex-col gap-1">
            <Select name="audience" label="응답 대상" defaultValue={survey?.audience ?? "all"}>
              <option value="all">전체 회원</option>
              <option value="members">회원</option>
              <option value="staff">운영진</option>
            </Select>
            <p className="text-xs text-gray-400">대상이 아닌 계정에는 설문이 보이지 않아요.</p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-gray-200 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">질문 프리셋</h2>
            <p className="text-xs text-gray-500">자주 쓰는 질문 묶음을 불러오거나 저장할 수 있어요.</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={selectedPresetId}
            onChange={(e) => setSelectedPresetId(e.target.value)}
            className="flex-1"
          >
            <option value="" disabled>
              {presets.length ? "저장된 프리셋 선택" : "저장된 프리셋이 없어요"}
            </option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.questions.length}문항)
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={loadPreset}
            disabled={!selectedPresetId}
          >
            불러오기
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            className="flex-1"
            placeholder="현재 질문을 프리셋으로 저장 (이름)"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 border border-gray-300"
            onClick={savePreset}
            disabled={presetSaving || !presetName.trim() || questions.length === 0}
          >
            {presetSaving ? "저장 중..." : "프리셋 저장"}
          </Button>
        </div>
        {presetMsg && (
          <p
            className={cn(
              "text-xs",
              presetMsg.error ? "text-danger" : "text-success",
            )}
          >
            {presetMsg.text}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span>
            <span className="text-base font-semibold text-gray-900">질문</span> <RequiredMark />
          </span>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">{questions.length}개</span>
        </div>

        {questions.length === 0 ? (
          <EmptyState
            className="border-dashed bg-gray-50 shadow-none"
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
                draggable={dragId === q.id}
                onDragStart={() => setDragIndex(i)}
                onDragEnd={() => {
                  setDragId(undefined);
                  setDragIndex(undefined);
                  setOverIndex(undefined);
                }}
                onDragOver={(e) => {
                  if (dragIndex === undefined) return;
                  e.preventDefault();
                  setOverIndex(i);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== undefined) moveQuestion(dragIndex, i);
                }}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border border-gray-200 bg-white px-3 py-3 dark:bg-gray-100",
                  dragIndex === i && "opacity-50",
                  overIndex === i && dragIndex !== i && "border-primary",
                )}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="shrink-0 cursor-grab rounded p-0.5 text-gray-400 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-primary active:cursor-grabbing"
                    onPointerDown={() => setDragId(q.id)}
                    onPointerUp={() => setDragId(undefined)}
                    onKeyDown={(e) => {
                      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                      e.preventDefault();
                      moveQuestion(i, e.key === "ArrowUp" ? i - 1 : i + 1);
                    }}
                    aria-label={`질문 ${i + 1} 순서 이동 (위/아래 방향키)`}
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden
                    >
                      <circle cx="7.5" cy="5" r="1.3" />
                      <circle cx="12.5" cy="5" r="1.3" />
                      <circle cx="7.5" cy="10" r="1.3" />
                      <circle cx="12.5" cy="10" r="1.3" />
                      <circle cx="7.5" cy="15" r="1.3" />
                      <circle cx="12.5" cy="15" r="1.3" />
                    </svg>
                  </button>
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto shrink-0 border border-gray-300 px-2"
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
                <Textarea
                  rows={2}
                  placeholder="질문 내용"
                  value={q.label}
                  onChange={(e) => updateLabel(q.id, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="secondary"
            className="h-12 border border-primary"
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
            className="h-12 border border-gray-300"
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
      </section>

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
      <div className="border-t border-gray-200 pt-4">
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={pending}
        >
          {pending ? (
            <span className="flex items-center gap-2">
              <Spinner />
              {isEdit ? "저장 중..." : "생성 중..."}
            </span>
          ) : isEdit ? (
            "저장"
          ) : (
            "생성"
          )}
        </Button>
      </div>
    </form>
  );
}
