"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPlace, updatePlace, deletePlace, backfillPlaceCoords } from "@/actions/place";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import type { Place } from "@/lib/types";

function PinBadge({ located }: { located: boolean }) {
  return (
    <span
      className={
        located
          ? "inline-flex items-center rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success"
          : "inline-flex items-center rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning"
      }
    >
      {located ? "핀 있음" : "핀 없음"}
    </span>
  );
}

export function PlaceManager({ places }: { places: Place[] }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [backfillMsg, setBackfillMsg] = useState<string>();
  const addFormRef = useRef<HTMLFormElement>(null);

  function handleBackfill() {
    setError(undefined);
    setBackfillMsg(undefined);
    startTransition(async () => {
      const result = await backfillPlaceCoords();
      if (result.error) {
        setError(result.error);
        return;
      }
      setBackfillMsg(
        `좌표 변환 완료 — 성공 ${result.done ?? 0} · 실패 ${result.failed ?? 0}`,
      );
      router.refresh();
    });
  }

  function run(action: () => Promise<{ error?: string }>, onDone?: () => void) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setError(result.error);
        return;
      }
      onDone?.();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-gray-900">장소 추가</p>
        <form
          ref={addFormRef}
          action={(fd) => run(() => createPlace(fd), () => addFormRef.current?.reset())}
          className="flex flex-col gap-3"
        >
          <Input name="name" label="장소명" placeholder="예) GDG대전 스페이스" required />
          <Input
            name="address"
            label="주소 (도로명)"
            placeholder="예) 대전 유성구 대학로 99"
          />
          <p className="text-xs text-gray-400">
            주소를 넣으면 저장 시 좌표로 변환돼 지도에 핀이 찍혀요.
          </p>
          <div>
            <Button type="submit" variant="primary" disabled={pending}>
              추가
            </Button>
          </div>
        </form>
      </Card>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={handleBackfill}
        >
          좌표 없는 장소 일괄 변환
        </Button>
        {backfillMsg && (
          <span className="text-sm text-gray-500">{backfillMsg}</span>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-danger bg-danger-soft px-3 py-2.5 text-sm text-danger">
          {error}
        </div>
      )}

      {places.length === 0 ? (
        <EmptyState
          title="등록된 장소가 없어요"
          description="정기세션이 열리는 장소를 추가해두면 이벤트에서 골라 쓸 수 있어요."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {places.map((place) =>
            editingId === place.id ? (
              <Card key={place.id}>
                <form
                  action={(fd) =>
                    run(() => updatePlace(place.id, fd), () => setEditingId(null))
                  }
                  className="flex flex-col gap-3"
                >
                  <Input name="name" label="장소명" defaultValue={place.name} required />
                  <Input
                    name="address"
                    label="주소 (도로명)"
                    defaultValue={place.address}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" variant="primary" size="sm" disabled={pending}>
                      저장
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditingId(null)}
                    >
                      취소
                    </Button>
                  </div>
                </form>
              </Card>
            ) : (
              <Card key={place.id} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-gray-900">{place.name}</p>
                    <PinBadge located={place.lat != null && place.lng != null} />
                  </div>
                  {place.address && (
                    <p className="mt-0.5 truncate text-sm text-gray-500">{place.address}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditingId(place.id)}
                  >
                    수정
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`'${place.name}' 장소를 삭제할까요?`)) {
                        run(() => deletePlace(place.id));
                      }
                    }}
                  >
                    삭제
                  </Button>
                </div>
              </Card>
            ),
          )}
        </div>
      )}
    </div>
  );
}
