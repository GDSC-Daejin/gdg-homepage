"use client";

import { useState, useTransition } from "react";
import { setApplicationNote, setApplicationStatus } from "@/actions/application";
import { Button } from "@/components/Button";
import type { ApplicationStatus } from "@/lib/types";

const NOTE_MAX = 200;

export function ReviewPanel({
  id,
  status,
  note,
}: {
  id: string;
  status: ApplicationStatus;
  note: string;
}) {
  const [value, setValue] = useState(note);
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string>();
  const [warning, setWarning] = useState<string>();
  const [pending, startTransition] = useTransition();

  function decide(next: ApplicationStatus) {
    if (pending) return;
    setError(undefined);
    setWarning(undefined);
    const prev = current;
    setCurrent(next);
    startTransition(async () => {
      if (value !== note) {
        const noteResult = await setApplicationNote(id, value);
        if (noteResult?.error) {
          setCurrent(prev);
          setError(noteResult.error);
          return;
        }
      }
      const result = await setApplicationStatus(id, next);
      if (result?.error) {
        setCurrent(prev);
        setError(result.error);
      } else if (result?.warning) {
        setWarning(result.warning);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_auto]">
      <div className="flex flex-col gap-1">
        <label htmlFor="review-note" className="text-sm font-semibold text-gray-700">
          심사 메모{" "}
          <span className="font-normal text-gray-400">
            (선택 · 결정 근거를 남겨두면 좋아요)
          </span>
        </label>
        <textarea
          id="review-note"
          rows={4}
          maxLength={NOTE_MAX}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={pending}
          placeholder="예: 프로젝트 경험이 구체적이고 참여 의지가 높음"
          className="w-full resize-none rounded-md border border-gray-300 bg-white dark:bg-gray-100 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-50 disabled:text-gray-400"
        />
        <p className="text-right text-xs text-gray-400">
          {value.length}/{NOTE_MAX}
        </p>
      </div>

      <div className="flex flex-col justify-center gap-3 md:w-56">
        <p className="text-center text-xs text-gray-500">
          결정하면 지원자 상태가 즉시 갱신돼요.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            onClick={() => decide("pending")}
            disabled={pending || current === "pending"}
          >
            보류
          </Button>
          <Button
            variant="danger-outline"
            onClick={() => decide("rejected")}
            disabled={pending || current === "rejected"}
          >
            불합격
          </Button>
        </div>
        <Button
          variant="primary"
          onClick={() => decide("accepted")}
          disabled={pending || current === "accepted"}
        >
          합격
        </Button>
        {error && <p className="text-center text-xs text-danger">{error}</p>}
        {warning && <p className="text-center text-xs text-warning">{warning}</p>}
      </div>
    </div>
  );
}
