"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleSurveyOpen } from "@/actions/survey";
import { Button } from "@/components/Button";

interface ToggleSurveyButtonProps {
  surveyId: string;
  isOpen: boolean;
}

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin"
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

function PowerIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 4v5" />
      <path d="M6 6.2a5.5 5.5 0 1 0 8 0" />
    </svg>
  );
}

export function ToggleSurveyButton({ surveyId, isOpen }: ToggleSurveyButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(undefined);
    startTransition(async () => {
      const result = await toggleSurveyOpen(surveyId, !isOpen);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant={isOpen ? "ghost" : "secondary"}
        size="sm"
        onClick={handleClick}
        disabled={pending}
        className={isOpen ? "gap-1.5 border border-gray-300" : "gap-1.5"}
      >
        {pending ? <Spinner /> : <PowerIcon />}
        {pending ? (isOpen ? "닫는 중..." : "여는 중...") : isOpen ? "닫기" : "열기"}
      </Button>
      {error && (
        <p className="rounded-md bg-danger-soft px-2 py-1 text-xs text-danger">{error}</p>
      )}
    </div>
  );
}
