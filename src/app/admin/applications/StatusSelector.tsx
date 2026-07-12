"use client";

import { useState, useTransition } from "react";
import { setApplicationStatus } from "@/actions/application";
import { cn } from "@/lib/cn";
import type { ApplicationStatus } from "@/lib/types";

const OPTIONS: { value: ApplicationStatus; label: string; active: string }[] = [
  { value: "waiting", label: "심사 대기", active: "bg-gray-600 text-white" },
  { value: "pending", label: "심사 중", active: "bg-warning text-white" },
  { value: "accepted", label: "합격", active: "bg-success text-white" },
  { value: "rejected", label: "불합격", active: "bg-danger text-white" },
];

export function StatusSelector({
  id,
  status,
}: {
  id: string;
  status: ApplicationStatus;
}) {
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string>();
  const [warning, setWarning] = useState<string>();
  const [pending, startTransition] = useTransition();

  function change(next: ApplicationStatus) {
    if (next === current || pending) return;
    setError(undefined);
    setWarning(undefined);
    const prev = current;
    setCurrent(next);
    startTransition(async () => {
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
    <div className="flex flex-col items-end gap-2">
      <div className="inline-flex gap-1 rounded-lg border border-gray-200 p-1">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={pending}
            onClick={() => change(opt.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60",
              opt.value === current
                ? opt.active
                : "text-gray-600 hover:bg-gray-100",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {warning && <p className="text-xs text-warning">{warning}</p>}
    </div>
  );
}
