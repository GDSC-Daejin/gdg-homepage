"use client";

import { useState, useTransition } from "react";
import { reopenInterview, resendApplicationResultEmail, setApplicationNote, setApplicationStatus } from "@/actions/application";
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
  const [emailMessage, setEmailMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const isNoShow = current === "no_show";

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

  async function reopen() {
    if (pending) return;
    setError(undefined);
    setWarning(undefined);
    startTransition(async () => {
      const result = await reopenInterview(id);
      if (result.error) setError(result.error);
      else setCurrent("pending");
    });
  }

  function resendResultEmail() {
    if (pending) return;
    setEmailMessage(undefined);
    startTransition(async () => {
      const result = await resendApplicationResultEmail(id);
      setEmailMessage(result.error ?? result.warning ?? "결과 이메일을 다시 보냈어요.");
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
          {isNoShow ? "면접 노쇼로 처리된 지원자예요." : "상태를 바꾸면 변경 이력이 남아요."}
        </p>
        {current === "waiting" && (
          <Button variant="primary" onClick={() => decide("reviewing")} disabled={pending}>
            서류 검토 시작
          </Button>
        )}
        {current === "reviewing" && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={() => decide("pending")} disabled={pending}>
              면접 대상 확정
            </Button>
            <Button variant="danger-outline" onClick={() => decide("rejected")} disabled={pending}>
              불합격
            </Button>
          </div>
        )}
        {current === "pending" && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={() => decide("accepted")} disabled={pending}>
              최종 합격
            </Button>
            <Button variant="danger-outline" onClick={() => decide("rejected")} disabled={pending}>
              불합격
            </Button>
          </div>
        )}
        {isNoShow && (
          <Button variant="secondary" onClick={reopen} disabled={pending}>
            예외적으로 재면접 허용
          </Button>
        )}
        {(current === "accepted" || current === "rejected") && (
          <>
            <p className="text-center text-xs text-gray-400">최종 결정이 완료된 지원자예요.</p>
            <Button variant="secondary" onClick={resendResultEmail} disabled={pending}>
              결과 이메일 재발송
            </Button>
            {emailMessage && <p className={`text-center text-xs ${emailMessage.includes("실패") || emailMessage.includes("필요") ? "text-danger" : "text-success"}`}>{emailMessage}</p>}
          </>
        )}
        {error && <p className="text-center text-xs text-danger">{error}</p>}
        {warning && <p className="text-center text-xs text-warning">{warning}</p>}
      </div>
    </div>
  );
}
