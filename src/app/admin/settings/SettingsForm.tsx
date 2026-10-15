"use client";

import { useRef, useState, useTransition } from "react";
import { updateRecruitingSettings } from "@/actions/recruiting";
import { Input } from "@/components/Input";
import { DatePicker } from "@/components/DatePicker";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { POSITION_LABELS, type Position } from "@/lib/types";
import type { RecruitingSettings } from "@/lib/types";
import { recruitingStatus, type RecruitingStatus } from "@/lib/recruiting-window";

const POSITIONS: Position[] = [
  "frontend",
  "backend",
  "designer",
  "beginner",
  "pm",
  "marketer",
  "vibecoder",
];

const STATUS_META: Record<RecruitingStatus, { label: string; detail: string; className: string; dotClassName: string }> = {
  open: {
    label: "모집 중",
    detail: "현재 /apply에서 지원을 받고 있어요.",
    className: "bg-success-soft text-success",
    dotClassName: "bg-success",
  },
  scheduled: {
    label: "모집 예정",
    detail: "시작일이 되면 자동으로 모집을 시작해요.",
    className: "bg-warning-soft text-warning",
    dotClassName: "bg-warning",
  },
  expired: {
    label: "자동 종료됨",
    detail: "지원 종료일이 지나 모집이 자동으로 닫혔어요.",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-200 dark:text-gray-700",
    dotClassName: "bg-gray-400",
  },
  closed: {
    label: "종료",
    detail: "모집을 시작하면 /apply에서 지원을 받아요.",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-200 dark:text-gray-700",
    dotClassName: "bg-gray-400",
  },
};

export function SettingsForm({ settings }: { settings: RecruitingSettings }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [positionChangeModalOpen, setPositionChangeModalOpen] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData>();
  const [pending, startTransition] = useTransition();

  const [isOpen, setIsOpen] = useState(settings.is_open);
  const [start, setStart] = useState(settings.apply_start ?? "");
  const [end, setEnd] = useState(settings.apply_end ?? "");

  const current = recruitingStatus(isOpen, start, end);
  const meta = STATUS_META[current];

  function positionsChanged(formData: FormData) {
    const next = formData.getAll("open_positions").map(String).sort();
    const current = [...settings.open_positions].sort();
    return next.length !== current.length || next.some((position, index) => position !== current[index]);
  }

  function submit(nextOpen: boolean, formData = formRef.current ? new FormData(formRef.current) : null) {
    if (!formData) return;
    setError(undefined);
    setSaved(false);
    formData.set("is_open", nextOpen ? "on" : "");
    startTransition(async () => {
      const result = await updateRecruitingSettings(formData);
      if (result?.error) setError(result.error);
      else {
        setIsOpen(nextOpen);
        setSaved(true);
      }
    });
  }

  function handleSubmit() {
    const formData = formRef.current ? new FormData(formRef.current) : null;
    if (!formData) return;
    if (current === "open" && positionsChanged(formData)) {
      setPendingFormData(formData);
      setPositionChangeModalOpen(true);
      return;
    }
    submit(isOpen, formData);
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="divide-y divide-gray-200"
    >
      <section className="space-y-5 pb-7" aria-labelledby="recruiting-basic-heading">
        <div>
          <h2 id="recruiting-basic-heading" className="text-base font-semibold text-gray-900">기본 정보</h2>
          <p className="mt-1 text-sm text-gray-500">지원 기간과 시즌명을 설정해 주세요.</p>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <Input name="season" label="시즌명" defaultValue={settings.season} required />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePicker
              name="apply_start"
              label="지원 시작일"
              defaultValue={start}
              max={end || undefined}
              onChange={setStart}
            />
            <DatePicker
              name="apply_end"
              label="지원 종료일"
              defaultValue={end}
              min={start || undefined}
              onChange={setEnd}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 py-7" aria-labelledby="recruiting-status-heading">
        <div>
          <h2 id="recruiting-status-heading" className="text-base font-semibold text-gray-900">모집 상태</h2>
          <p className="mt-1 text-sm text-gray-500">지원 페이지를 열고 닫을 수 있어요.</p>
        </div>
        <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:bg-gray-100">
          <div className="min-w-0">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${meta.className}`} aria-live="polite">
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClassName}`} aria-hidden="true" />
              {meta.label}
            </span>
            <p className="mt-2 text-sm text-gray-600">{meta.detail}</p>
          </div>
          <Button
            type="button"
            variant={isOpen ? "danger-outline" : "primary"}
            size="sm"
            className="shrink-0 self-start sm:self-auto"
            disabled={pending}
            onClick={() => submit(!isOpen)}
          >
            {isOpen ? "모집 종료하기" : "모집 시작하기"}
          </Button>
        </div>
      </section>

      <fieldset className="space-y-4 py-7" aria-labelledby="recruiting-positions-heading">
        <legend id="recruiting-positions-heading" className="text-base font-semibold text-gray-900">모집 포지션</legend>
        <p className="text-sm text-gray-500">지원받을 포지션을 선택해 주세요. 모집 중에는 포지션을 변경할 수 없어요.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {POSITIONS.map((position) => (
            <label
              key={position}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 transition-colors hover:border-primary hover:bg-primary-soft dark:bg-gray-100"
            >
              <input
                type="checkbox"
                name="open_positions"
                value={position}
                defaultChecked={settings.open_positions.includes(position)}
                className="h-4 w-4 accent-primary"
              />
              <span>{POSITION_LABELS[position]}</span>
              {position === "beginner" && <span className="text-xs text-gray-400">신입</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="min-h-5 text-sm">
          {error && <p className="text-danger">{error}</p>}
          {saved && !error && <p className="text-success">변경사항을 저장했어요.</p>}
        </div>
        <Button type="submit" variant="primary" disabled={pending} className="w-full sm:w-auto">
          {pending ? "저장 중…" : "변경사항 저장"}
        </Button>
      </div>
      <Modal
        open={positionChangeModalOpen}
        onClose={() => setPositionChangeModalOpen(false)}
        ariaLabel="모집 포지션 변경 안내"
      >
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">모집 포지션을 변경할까요?</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              모집 포지션을 바꾸려면 모집을 우선 종료해야해요!
              <br />
              모집을 종료하고 변경사항을 저장할까요?
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPositionChangeModalOpen(false)}>
              취소
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={pending || !pendingFormData}
              onClick={() => {
                if (!pendingFormData) return;
                setPositionChangeModalOpen(false);
                submit(false, pendingFormData);
              }}
            >
              모집 종료 후 저장
            </Button>
          </div>
        </div>
      </Modal>
    </form>
  );
}
