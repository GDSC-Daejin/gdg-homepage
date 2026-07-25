"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePlaceNotes } from "@/actions/place";
import { Textarea } from "@/components/Textarea";
import { Button } from "@/components/Button";

export function PlaceNotesForm({
  placeId,
  notes,
}: {
  placeId: string;
  notes: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        setError(undefined);
        setSaved(false);
        startTransition(async () => {
          const result = await updatePlaceNotes(placeId, fd);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSaved(true);
          router.refresh();
        });
      }}
      className="flex flex-col gap-3"
    >
      <Textarea
        name="notes"
        rows={5}
        defaultValue={notes}
        placeholder={"예) 3층 세미나실 — 정문 옆 엘리베이터\n주차: 건물 뒤편, 2시간 무료\n와이파이: GDG-GUEST"}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          저장
        </Button>
        {saved && <span className="text-xs text-gray-500">저장됐어요</span>}
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </form>
  );
}
