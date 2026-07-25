"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPlace, updatePlace, deletePlace, backfillPlaceCoords } from "@/actions/place";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import type { Place } from "@/lib/types";

// backfillPlaceCoords()의 대상 집합과 같아야 한다 — 주소가 빈 장소는 변환 대상이 아니다
function needsPin(place: Place) {
  return !!place.address && (place.lat == null || place.lng == null);
}

function PlaceStatusBadge({ place }: { place: Place }) {
  if (place.lat != null && place.lng != null) return null;
  const pending = needsPin(place);
  return (
    <span
      className={
        pending
          ? "inline-flex items-center rounded-full bg-warning-soft text-warning px-2 py-0.5 text-xs font-medium"
          : "inline-flex items-center rounded-full bg-gray-100 text-gray-500 px-2 py-0.5 text-xs font-medium"
      }
    >
      {pending ? "핀 없음" : "주소 없음"}
    </span>
  );
}

export function PlaceManager({ places }: { places: Place[] }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [backfillMsg, setBackfillMsg] = useState<string>();
  const [deleting, setDeleting] = useState<Place | null>(null);
  const addFormRef = useRef<HTMLFormElement>(null);
  const pendingCount = places.filter(needsPin).length;

  function handleBackfill() {
    setError(undefined);
    setBackfillMsg(undefined);
    startTransition(async () => {
      const result = await backfillPlaceCoords();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.failures?.length) {
        // 실패 사유는 UI에 다 못 담으니 콘솔로 — 관리자가 F12로 확인
        console.warn("[핀 일괄 변환] 실패 목록", result.failures);
        console.table(result.failures);
      }
      setBackfillMsg(
        `좌표 변환 완료 — 성공 ${result.done ?? 0} · 실패 ${result.failed ?? 0}` +
          (result.failures?.length ? " (사유는 브라우저 콘솔 확인)" : ""),
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
      <Card>
        <p className="mb-2 text-xs font-medium text-gray-700">장소 추가</p>
        <form
          ref={addFormRef}
          action={(fd) => run(() => createPlace(fd), () => addFormRef.current?.reset())}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="sm:w-56">
            <Input name="name" label="장소명" placeholder="예) GDG대전 스페이스" required />
          </div>
          <div className="flex-1">
            <Input
              name="address"
              label="주소 (도로명)"
              placeholder="예) 대전 유성구 대학로 99"
            />
          </div>
          <Button type="submit" variant="primary" disabled={pending}>
            추가
          </Button>
        </form>
        <p className="mt-2 text-xs text-gray-400">
          주소를 넣으면 저장 시 좌표로 변환돼 지도에 핀이 찍혀요.
        </p>
      </Card>

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
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-medium text-gray-700">
              등록된 장소 <span className="text-gray-400">{places.length}곳</span>
              {pendingCount > 0 && (
                <span className="text-warning"> · 핀 없음 {pendingCount}곳</span>
              )}
            </p>
            {pendingCount > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={handleBackfill}
              >
                핀 일괄 변환
              </Button>
            )}
            {backfillMsg && <span className="text-xs text-gray-500">{backfillMsg}</span>}
          </div>
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
                    <PlaceStatusBadge place={place} />
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
                    onClick={() => setDeleting(place)}
                  >
                    삭제
                  </Button>
                </div>
              </Card>
            ),
          )}
        </div>
      )}

      <Modal open={!!deleting} onClose={() => setDeleting(null)} ariaLabel="장소 삭제 확인">
        <h2 className="text-base font-semibold text-gray-900">
          &lsquo;{deleting?.name}&rsquo; 장소를 삭제할까요?
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          삭제하면 되돌릴 수 없어요. 이 장소를 쓰던 이벤트의 장소 정보가 비워질 수 있어요.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setDeleting(null)}>
            취소
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={() => {
              const target = deleting;
              if (!target) return;
              // run()은 실패 시 onDone을 부르지 않는다 — 모달이 열린 채 남는 게 의도된 동작
              run(() => deletePlace(target.id), () => setDeleting(null));
            }}
          >
            삭제
          </Button>
        </div>
      </Modal>
    </div>
  );
}
