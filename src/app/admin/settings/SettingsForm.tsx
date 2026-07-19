"use client";

import { useRef, useState, useTransition } from "react";
import { updateRecruitingSettings } from "@/actions/recruiting";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { POSITION_LABELS, type Position } from "@/lib/types";
import type { RecruitingSettings } from "@/lib/types";

const POSITIONS: Position[] = ["frontend", "backend", "designer", "beginner"];

/** 오늘(KST) "YYYY-MM-DD" — isRecruitingOpen과 동일 규칙(서버 헬퍼는 server-only라 인라인) */
function kstToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type Status = "closed" | "scheduled" | "open" | "expired";

function status(isOpen: boolean, start: string, end: string): Status {
  if (!isOpen) return "closed";
  const today = kstToday();
  if (start && today < start) return "scheduled";
  if (end && today > end) return "expired";
  return "open";
}

const STATUS_META: Record<Status, { label: string; className: string }> = {
  open: { label: "🟢 모집 중", className: "bg-success-soft text-success" },
  scheduled: { label: "🕒 모집 예정 — 시작일이 되면 자동으로 열려요", className: "bg-warning-soft text-warning" },
  expired: { label: "⛔ 자동 종료됨 — 종료일이 지났어요", className: "bg-gray-100 text-gray-500" },
  closed: { label: "⚪ 종료", className: "bg-gray-100 text-gray-500" },
};

export function SettingsForm({ settings }: { settings: RecruitingSettings }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const [isOpen, setIsOpen] = useState(settings.is_open);
  const [start, setStart] = useState(settings.apply_start ?? "");
  const [end, setEnd] = useState(settings.apply_end ?? "");

  const current = status(isOpen, start, end);
  const meta = STATUS_META[current];

  function submit(nextOpen: boolean) {
    if (!formRef.current) return;
    setError(undefined);
    setSaved(false);
    const formData = new FormData(formRef.current);
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

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        submit(isOpen);
      }}
      className="flex flex-col gap-4"
    >
      <Input name="season" label="시즌명" defaultValue={settings.season} required />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          name="apply_start"
          type="date"
          label="지원 시작일"
          value={start}
          max={end || undefined}
          onChange={(e) => setStart(e.target.value)}
        />
        <Input
          name="apply_end"
          type="date"
          label="지원 종료일"
          value={end}
          min={start || undefined}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-700">모집 상태</span>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.className}`}>
            {meta.label}
          </span>
          <Button
            type="button"
            variant={isOpen ? "danger-outline" : "primary"}
            size="sm"
            disabled={pending}
            onClick={() => submit(!isOpen)}
          >
            {isOpen ? "모집 종료하기" : "모집 시작하기"}
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          {isOpen
            ? "지원 종료일이 지나면 자동으로 종료돼요. 미리 끝내려면 종료하기를 누르세요."
            : "모집 시작하기를 누르면 /apply에서 지원을 받아요."}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">모집 파트</span>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {POSITIONS.map((position) => (
            <label
              key={position}
              className="flex items-center gap-1.5 text-sm text-gray-700"
            >
              <input
                type="checkbox"
                name="open_positions"
                value={position}
                defaultChecked={settings.open_positions.includes(position)}
              />
              {POSITION_LABELS[position]}
              {position === "beginner" && (
                <span className="text-xs text-gray-400">(신입)</span>
              )}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
      {saved && !error && <p className="text-xs text-success">저장했어요</p>}
      <Button
        type="submit"
        variant="secondary"
        className="mt-2 w-full sm:w-auto"
        disabled={pending}
      >
        저장
      </Button>
    </form>
  );
}
