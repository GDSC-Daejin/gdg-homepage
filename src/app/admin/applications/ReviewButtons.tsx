"use client";

import { useState, useTransition } from "react";
import { reviewApplication } from "@/actions/application";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import type { ApplicationStatus } from "@/lib/types";

type ApplicantSummary = {
  name: string;
  student_no: string | null;
  major: string | null;
};

const CONFIRM_CONTENT: Record<
  "accepted" | "rejected",
  {
    icon: React.ReactNode;
    iconBg: string;
    title: string;
    description: string;
    confirmLabel: string;
    confirmVariant: "primary" | "danger";
  }
> = {
  accepted: {
    icon: (
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <circle cx="10" cy="10" r="7.5" />
        <path d="m7 10 2 2 4-4" />
      </svg>
    ),
    iconBg: "bg-primary-soft text-primary",
    title: "합격 처리할까요?",
    description:
      "한 번 확정하면 이 지원서는 다시 심사할 수 없어요. 아래 지원자를 합격 처리합니다.",
    confirmLabel: "합격 처리",
    confirmVariant: "primary",
  },
  rejected: {
    icon: (
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <circle cx="10" cy="10" r="7.5" />
        <path d="M10 6.5v4M10 13.5h.01" />
      </svg>
    ),
    iconBg: "bg-danger-soft text-danger",
    title: "불합격 처리할까요?",
    description:
      "한 번 확정하면 이 지원서는 다시 심사할 수 없어요. 이 지원자를 불합격 처리합니다.",
    confirmLabel: "불합격 처리",
    confirmVariant: "danger",
  },
};

export function ReviewButtons({
  id,
  status,
  applicant,
}: {
  id: string;
  status: ApplicationStatus;
  applicant: ApplicantSummary;
}) {
  const [error, setError] = useState<string>();
  const [target, setTarget] = useState<"accepted" | "rejected">();
  const [pending, startTransition] = useTransition();

  if (status !== "pending") return null;

  function handleConfirm() {
    if (!target) return;
    setError(undefined);
    startTransition(async () => {
      const result = await reviewApplication(id, target);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setTarget(undefined);
    });
  }

  const content = target ? CONFIRM_CONTENT[target] : undefined;

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          variant="danger-outline"
          size="sm"
          disabled={pending}
          onClick={() => setTarget("rejected")}
        >
          불합격
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={pending}
          onClick={() => setTarget("accepted")}
        >
          합격
        </Button>
      </div>
      {error && (
        <p className="flex items-center gap-1 text-xs text-danger">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5 shrink-0"
          >
            <circle cx="10" cy="10" r="7.5" />
            <path d="M10 6.5v4M10 13.5h.01" />
          </svg>
          {error}
        </p>
      )}

      <Modal open={Boolean(target)} onClose={() => !pending && setTarget(undefined)}>
        {content && target && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-start gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-full ${content.iconBg}`}
              >
                {content.icon}
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {content.title}
                </h2>
                <p className="mt-1 text-sm text-gray-500">{content.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                {applicant.name.charAt(0) || "?"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {applicant.name}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {applicant.student_no ?? "정보 없음"} · {applicant.major ?? "정보 없음"}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => setTarget(undefined)}
              >
                취소
              </Button>
              <Button
                variant={content.confirmVariant}
                size="sm"
                disabled={pending}
                onClick={handleConfirm}
                className="gap-1.5"
              >
                {pending && (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                )}
                {pending ? "처리 중..." : content.confirmLabel}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
