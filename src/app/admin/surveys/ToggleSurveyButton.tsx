"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleSurveyOpen } from "@/actions/survey";
import { Button } from "@/components/Button";

interface ToggleSurveyButtonProps {
  surveyId: string;
  isOpen: boolean;
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
        variant="secondary"
        size="sm"
        onClick={handleClick}
        disabled={pending}
      >
        {isOpen ? "닫기" : "열기"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
