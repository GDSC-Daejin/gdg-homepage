"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSurvey } from "@/actions/survey";
import { Button } from "@/components/Button";
import { useDismiss } from "@/lib/useDismiss";

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

function TrashIcon() {
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
      <path d="M4.5 6h11M8.5 6V4.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V6M6 6l.6 9a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9L14 6" />
    </svg>
  );
}

export function DeleteSurveyButton({
  surveyId,
  responseCount,
}: {
  surveyId: string;
  responseCount?: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const { ref, open, setOpen } = useDismiss<HTMLDivElement>();

  function handleDelete() {
    setError(undefined);
    startTransition(async () => {
      const result = await deleteSurvey(surveyId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5 border border-gray-300"
        onClick={() => setOpen(true)}
      >
        <TrashIcon />
        삭제
      </Button>
      {error && (
        <p className="rounded-md bg-danger-soft px-2 py-1 text-xs text-danger">{error}</p>
      )}
      {open && (
        <div className="material-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
          <div ref={ref} className="material-panel w-full max-w-sm rounded-xl bg-white p-6 shadow-card">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-soft">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-danger"
              >
                <path d="M10 6.5v4M10 13.5h.01" />
                <path d="M8.6 3.4 2.9 15a1.5 1.5 0 0 0 1.3 2.2h11.6a1.5 1.5 0 0 0 1.3-2.2L11.4 3.4a1.5 1.5 0 0 0-2.8 0Z" />
              </svg>
            </div>
            <h2 className="mt-3 text-base font-semibold text-gray-900">
              설문을 삭제할까요?
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {responseCount ? (
                <>
                  삭제하면 수집된 <strong className="font-semibold text-gray-700">응답 {responseCount}건</strong>도
                  함께 사라지고 되돌릴 수 없어요.
                </>
              ) : (
                "삭제하면 되돌릴 수 없어요."
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                취소
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleDelete}
                disabled={pending}
                className="gap-1.5"
              >
                {pending && <Spinner />}
                삭제
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
