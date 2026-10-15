"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  applyApplicationQuestionPreset,
  createApplicationQuestion,
  deleteApplicationQuestion,
  saveApplicationQuestionPreset,
  updateApplicationQuestion,
} from "@/actions/application-question";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { PageHeader } from "@/components/PageHeader";
import { POSITION_LABELS, type ApplicationQuestion, type ApplicationQuestionPreset, type Position } from "@/lib/types";

const POSITIONS: Position[] = ["frontend", "backend", "designer", "beginner", "pm", "marketer", "vibecoder"];

export function ApplicationQuestionManager({
  questions,
  presets,
}: {
  questions: ApplicationQuestion[];
  presets: ApplicationQuestionPreset[];
}) {
  const router = useRouter();
  const [position, setPosition] = useState<Position>("frontend");
  const [newQuestion, setNewQuestion] = useState("");
  const [presetName, setPresetName] = useState("");
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const currentQuestions = useMemo(
    () => questions.filter((question) => question.position === position),
    [questions, position],
  );
  const currentPresets = presets.filter((preset) => preset.position === position);

  function run(action: () => Promise<{ error?: string } | undefined>, success: string) {
    setMessage(undefined);
    startTransition(async () => {
      const result = await action();
      if (result?.error) return setMessage(result.error);
      setMessage(success);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="지원 질문 관리"
        description="포지션별 지원 질문을 관리하고, 질문 세트를 프리셋으로 저장해요."
      />

      <div className="flex flex-wrap gap-2">
        {POSITIONS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setPosition(item);
              setMessage(undefined);
            }}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              position === item ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {POSITION_LABELS[item]}
          </button>
        ))}
      </div>

      <Card className="space-y-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{POSITION_LABELS[position]} 질문</h2>
          <p className="mt-1 text-sm text-gray-500">지원자가 이 포지션을 선택하면 아래 질문을 입력해요.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="새 질문"
              value={newQuestion}
              onChange={(event) => setNewQuestion(event.target.value)}
              placeholder="예) 이 포지션에 지원한 이유를 알려주세요"
            />
          </div>
          <Button
            type="button"
            variant="primary"
            disabled={pending || !newQuestion.trim()}
            onClick={() => run(
              () => createApplicationQuestion(position, newQuestion),
              "질문을 추가했어요.",
            )}
          >
            질문 추가
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {currentQuestions.length === 0 ? (
            <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">아직 설정된 질문이 없어요.</p>
          ) : (
            currentQuestions.map((question, index) => (
              <QuestionRow
                key={question.id}
                question={question}
                index={index}
                disabled={pending}
                onSave={(label) => run(() => updateApplicationQuestion(question.id, label), "질문을 수정했어요.")}
                onDelete={() => run(() => deleteApplicationQuestion(question.id), "질문을 삭제했어요.")}
              />
            ))
          )}
        </div>

        <div className="border-t border-gray-200 pt-5">
          <h3 className="text-sm font-semibold text-gray-900">질문 세트 프리셋</h3>
          <p className="mt-1 text-sm text-gray-500">현재 질문 목록을 저장해두고 나중에 다시 적용할 수 있어요.</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label="프리셋 이름"
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                placeholder="예) 2026 하반기 모집"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={pending || !presetName.trim() || currentQuestions.length === 0}
              onClick={() => run(
                async () => {
                  const result = await saveApplicationQuestionPreset(
                    position,
                    presetName,
                    currentQuestions.map((question) => question.label),
                  );
                  if (!result.error) setPresetName("");
                  return result;
                },
                "프리셋을 저장했어요.",
              )}
            >
              프리셋 저장
            </Button>
          </div>
          {currentPresets.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {currentPresets.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => applyApplicationQuestionPreset(preset.id), `'${preset.name}' 프리셋을 적용했어요.`)}
                >
                  {preset.name} 적용
                </Button>
              ))}
            </div>
          )}
        </div>
        {message && <p aria-live="polite" className="text-sm text-gray-600">{message}</p>}
      </Card>
    </div>
  );
}

function QuestionRow({
  question,
  index,
  disabled,
  onSave,
  onDelete,
}: {
  question: ApplicationQuestion;
  index: number;
  disabled: boolean;
  onSave: (label: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(question.label);

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-primary bg-primary-soft p-3 sm:flex-row sm:items-end">
        <div className="flex-1"><Input label={`질문 ${index + 1}`} value={value} onChange={(event) => setValue(event.target.value)} /></div>
        <div className="flex gap-2">
          <Button type="button" variant="primary" size="sm" disabled={disabled || !value.trim()} onClick={() => { onSave(value); setEditing(false); }}>저장</Button>
          <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => { setValue(question.label); setEditing(false); }}>취소</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
      <p className="text-sm text-gray-800"><span className="mr-2 font-semibold text-primary">Q{index + 1}</span>{question.label}</p>
      <div className="flex shrink-0 gap-3 text-xs font-medium text-gray-500">
        <button type="button" disabled={disabled} onClick={() => setEditing(true)} className="hover:text-primary disabled:opacity-50">수정</button>
        <button type="button" disabled={disabled} onClick={onDelete} className="hover:text-danger disabled:opacity-50">삭제</button>
      </div>
    </div>
  );
}
