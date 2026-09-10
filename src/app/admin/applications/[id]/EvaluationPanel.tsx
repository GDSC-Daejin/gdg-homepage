"use client";

import { useState, useTransition } from "react";
import { saveApplicationEvaluation } from "@/actions/application";
import { Button } from "@/components/Button";
import { Select } from "@/components/Select";
import type {
  ApplicationEvaluation,
  ApplicationEvaluationStage,
  EvaluationRecommendation,
} from "@/lib/types";

const CRITERIA = [
  ["motivation", "지원 동기"],
  ["communication", "커뮤니케이션"],
  ["collaboration", "협업 가능성"],
  ["fit", "직무·포지션 적합성"],
  ["availability", "활동 가능성"],
  ["growth", "성장 가능성"],
] as const;

const STAGE_LABELS: Record<ApplicationEvaluationStage, string> = {
  document: "서류 평가",
  interview: "면접 평가",
};

const RECOMMENDATION_LABELS: Record<EvaluationRecommendation, string> = {
  accepted: "합격 추천",
  pending: "보류 추천",
  rejected: "불합격 추천",
};

function EvaluationForm({
  applicationId,
  stage,
  initial,
  submissionCount,
}: {
  applicationId: string;
  stage: ApplicationEvaluationStage;
  initial?: ApplicationEvaluation;
  submissionCount: number;
}) {
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(CRITERIA.map(([key]) => [key, initial?.scores[key] ?? 0])),
  );
  const [recommendation, setRecommendation] = useState<EvaluationRecommendation>(
    initial?.recommendation ?? "pending",
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit() {
    setMessage(undefined);
    startTransition(async () => {
      const result = await saveApplicationEvaluation(
        applicationId,
        stage,
        scores,
        recommendation,
        note,
      );
      setMessage(result.error ?? "평가를 저장했어요");
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-900">{STAGE_LABELS[stage]}</p>
        <span className="text-xs text-gray-500">제출 {submissionCount}명</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CRITERIA.map(([key, label]) => (
          <Select
            key={key}
            label={label}
            value={String(scores[key] || "")}
            onChange={(event) =>
              setScores((current) => ({ ...current, [key]: Number(event.target.value) }))
            }
          >
            <option value="" disabled>점수 선택</option>
            {[1, 2, 3, 4, 5].map((score) => (
              <option key={score} value={score}>{score}점</option>
            ))}
          </Select>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[12rem_1fr]">
        <Select
          label="종합 추천"
          value={recommendation}
          onChange={(event) => setRecommendation(event.target.value as EvaluationRecommendation)}
        >
          {Object.entries(RECOMMENDATION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          종합 의견
          <textarea
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="평가 근거를 남겨주세요"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        {message && <p className={`text-xs ${message.includes("저장") ? "text-success" : "text-danger"}`}>{message}</p>}
        <Button type="button" size="sm" variant="primary" disabled={pending} onClick={submit}>
          {pending ? "저장 중..." : initial ? "평가 수정" : "평가 제출"}
        </Button>
      </div>
    </div>
  );
}

export function EvaluationPanel({
  applicationId,
  evaluations,
  evaluatorId,
}: {
  applicationId: string;
  evaluations: ApplicationEvaluation[];
  evaluatorId: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-gray-700">구조화 평가</p>
        <p className="mt-1 text-xs text-gray-500">제출 전에는 다른 평가자의 점수와 의견을 공개하지 않아요.</p>
      </div>
      {(["document", "interview"] as const).map((stage) => (
        <EvaluationForm
          key={stage}
          applicationId={applicationId}
          stage={stage}
          initial={evaluations.find((evaluation) => evaluation.evaluator_id === evaluatorId && evaluation.stage === stage)}
          submissionCount={evaluations.filter((evaluation) => evaluation.stage === stage).length}
        />
      ))}
    </div>
  );
}
