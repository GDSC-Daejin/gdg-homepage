"use client";

import { useState, useTransition } from "react";
import { updateRecruitingSettings } from "@/actions/recruiting";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { POSITION_LABELS, type Position } from "@/lib/types";
import type { RecruitingSettings } from "@/lib/types";

const POSITIONS: Position[] = ["frontend", "backend", "designer"];

export function SettingsForm({ settings }: { settings: RecruitingSettings }) {
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await updateRecruitingSettings(formData);
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <Input name="season" label="시즌명" defaultValue={settings.season} required />
      <label className="flex items-center gap-1.5 text-sm text-gray-700">
        <input
          type="checkbox"
          name="is_open"
          defaultChecked={settings.is_open}
        />
        모집 열기 — 켜면 /apply에서 지원을 받아요
      </label>
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
            </label>
          ))}
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {saved && !error && <p className="text-xs text-success">저장했어요</p>}
      <Button
        type="submit"
        variant="primary"
        className="mt-2 w-full sm:w-auto"
        disabled={pending}
      >
        저장
      </Button>
    </form>
  );
}
