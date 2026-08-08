"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEvent, updateEvent } from "@/actions/event";
import { createPlace } from "@/actions/place";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import { Select } from "@/components/Select";
import { DatePicker } from "@/components/DatePicker";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import {
  EVENT_TYPE_BG as TYPE_DOT,
  EVENT_TYPE_OPTIONS as TYPE_OPTIONS,
  EVENT_TYPE_SELECTED as TYPE_SELECTED,
} from "@/lib/event-type";
import type { Event, EventType, Place } from "@/lib/types";

function RequiredMark() {
  return <span className="text-danger">*</span>;
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, "0");
  const minute = index % 2 ? "30" : "00";
  return `${hour}:${minute}`;
});

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
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

interface EventFormProps {
  event?: Event;
  places?: Place[];
  /** 달력에서 클릭한 날짜("YYYY-MM-DD"). 생성 시 날짜를 미리 채운다. */
  defaultDate?: string;
  /** 넘기면 저장 후 페이지 이동 대신 이 콜백을 부른다(모달에서 닫기용). */
  onSuccess?: () => void;
}

export function EventForm({ event, places = [], defaultDate, onSuccess }: EventFormProps) {
  const router = useRouter();
  const isEdit = Boolean(event);
  const [type, setType] = useState<EventType>(event?.type ?? "session");
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  // 장소를 등록하러 이벤트 폼을 떠나지 않도록, 여기서 바로 추가하고 곧장 선택한다.
  const [placeOptions, setPlaceOptions] = useState<Place[]>(places);
  const [placeId, setPlaceId] = useState(event?.place_id ?? "");
  const [addingPlace, setAddingPlace] = useState(false);
  const [newPlaceName, setNewPlaceName] = useState("");
  const [newPlaceAddress, setNewPlaceAddress] = useState("");
  const [placeError, setPlaceError] = useState<string>();
  const [placePending, startPlaceTransition] = useTransition();

  function addPlace() {
    setPlaceError(undefined);
    startPlaceTransition(async () => {
      const fd = new FormData();
      fd.set("name", newPlaceName);
      fd.set("address", newPlaceAddress);
      const result = await createPlace(fd);
      if (result.error || !result.place) {
        setPlaceError(result.error ?? "장소를 추가하지 못했어요");
        return;
      }
      setPlaceOptions((prev) => [...prev, result.place!]);
      setPlaceId(result.place.id);
      setNewPlaceName("");
      setNewPlaceAddress("");
      setAddingPlace(false);
    });
  }

  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flashSaved() {
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1600);
  }

  function handleSubmit(formData: FormData) {
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = event
        ? await updateEvent(event.id, formData)
        : await createEvent(formData);

      if (result?.error) {
        setError(result.error);
        return;
      }

      if (onSuccess) {
        router.refresh();
        onSuccess();
      } else if (event) {
        router.refresh();
        flashSaved();
      } else {
        router.push("/admin/events");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      {isEdit ? (
        <Select
          name="type"
          label="유형"
          value={type}
          onChange={(e) => setType(e.target.value as EventType)}
          required
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      ) : (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            유형 <RequiredMark />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.98]",
                  type === opt.value
                    ? TYPE_SELECTED[opt.value]
                    : "border-gray-300 text-gray-700 hover:bg-gray-50",
                )}
              >
                <input
                  type="radio"
                  name="type"
                  value={opt.value}
                  checked={type === opt.value}
                  onChange={() => setType(opt.value)}
                  className="sr-only"
                />
                <span className={cn("h-2 w-2 rounded-full", TYPE_DOT[opt.value])} />
                {opt.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400">유형에 따라 목록의 배지 색이 달라져요.</p>
        </div>
      )}

      <Input
        name="title"
        label={isEdit ? "제목" : <>제목 <RequiredMark /></>}
        placeholder="예) Flutter로 앱 만들기 4주차"
        defaultValue={event?.title}
        required
      />

      <Textarea
        name="description"
        label="설명"
        placeholder="이벤트를 한두 문장으로 소개해요."
        defaultValue={event?.description}
        rows={3}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <DatePicker name="event_date" label={<>날짜 <RequiredMark /></>} defaultValue={event?.event_date ?? defaultDate ?? ""} emptyOption="미정" />
        <Select name="start_time" label={<>시작 시간 <RequiredMark /></>} defaultValue={event?.start_time?.slice(0, 5) ?? ""}>
          <option value="">미정</option>
          {TIME_OPTIONS.map((time) => <option key={time} value={time}>{time}</option>)}
        </Select>
        <Select name="end_time" label={<>종료 시간 <RequiredMark /></>} defaultValue={event?.end_time?.slice(0, 5) ?? ""}>
          <option value="">미정</option>
          {TIME_OPTIONS.map((time) => <option key={time} value={time}>{time}</option>)}
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          type="number"
          name="capacity"
          label="정원"
          placeholder="예) 30"
          min={1}
          defaultValue={event?.capacity ?? 14}
        />
        <Select
          name="place_id"
          label="장소"
          value={placeId}
          onChange={(e) => setPlaceId(e.target.value)}
        >
          <option value="">장소 없음</option>
          {placeOptions.map((place) => (
            <option key={place.id} value={place.id}>
              {place.name}
            </option>
          ))}
        </Select>
        <Input
          name="speaker"
          label="발표자"
          placeholder="예) 홍길동"
          defaultValue={event?.speaker}
        />
      </div>
      {addingPlace ? (
        <div className="-mt-2 flex flex-col gap-3 rounded-md border border-gray-200 bg-gray-50 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="장소명"
              placeholder="예) GDG대전 스페이스"
              value={newPlaceName}
              onChange={(e) => setNewPlaceName(e.target.value)}
            />
            <Input
              label="주소 (도로명)"
              placeholder="예) 대전 유성구 대학로 99"
              value={newPlaceAddress}
              onChange={(e) => setNewPlaceAddress(e.target.value)}
            />
          </div>
          {placeError && <p className="text-xs text-danger">{placeError}</p>}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={addPlace}
              disabled={placePending || !newPlaceName.trim()}
            >
              {placePending ? "추가 중…" : "장소 추가"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setAddingPlace(false);
                setPlaceError(undefined);
              }}
            >
              취소
            </Button>
          </div>
        </div>
      ) : (
        <p className="-mt-2 text-xs text-gray-400">
          목록에 없으면{" "}
          <button
            type="button"
            onClick={() => setAddingPlace(true)}
            className="font-medium text-primary hover:underline"
          >
            여기서 바로 추가
          </button>
          할 수 있어요. 지도·좌표는 주소에서 자동으로 채워져요.{" "}
          <a href="/admin/places" className="text-primary hover:underline">
            장소 관리
          </a>
        </p>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-danger bg-danger-soft px-3 py-2.5 text-sm text-danger">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            className="h-4 w-4 shrink-0"
          >
            <circle cx="10" cy="10" r="8" />
            <path d="M10 6v5M10 14h.01" strokeLinecap="round" />
          </svg>
          {error}
        </div>
      )}
      <div className="mt-2 flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? (
            <span className="flex items-center gap-2">
              <Spinner />
              {event ? "수정 중..." : "생성 중..."}
            </span>
          ) : event ? (
            "수정"
          ) : (
            "생성"
          )}
        </Button>
        {event && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-sm text-success transition-opacity duration-200",
              saved ? "opacity-100" : "opacity-0",
            )}
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path d="M5 10l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            저장했어요
          </span>
        )}
      </div>
    </form>
  );
}
