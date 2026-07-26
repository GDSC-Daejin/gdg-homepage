"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEvent, updateEvent } from "@/actions/event";
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

const DAY_TRIP_TYPES: EventType[] = ["session", "study", "mogakco"];

/** 달력 빈 칸에서 만들 때 시각까지는 모르니 저녁 7시로 열어 둔다. */
const DEFAULT_START_TIME = "19:00";

function RequiredMark() {
  return <span className="text-danger">*</span>;
}

function OptionalMark({ children }: { children?: React.ReactNode }) {
  return <span className="font-normal text-gray-400">{children ?? "선택"}</span>;
}

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

function toKstDatetimeLocal(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function toKstDateOnly(iso: string): string {
  return toKstDatetimeLocal(iso).split("T")[0];
}

function toKstTimeOnly(iso: string): string {
  return toKstDatetimeLocal(iso).split("T")[1];
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

  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flashSaved() {
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1600);
  }

  function handleSubmit(formData: FormData) {
    setError(undefined);
    setSaved(false);
    if (DAY_TRIP_TYPES.includes(type)) {
      const eventDate = formData.get("event_date");
      const startTime = formData.get("start_time");
      const endTime = formData.get("end_time");
      if (typeof eventDate === "string" && eventDate && typeof startTime === "string" && startTime) {
        formData.set("starts_at", new Date(`${eventDate}T${startTime}`).toISOString());
      }
      if (typeof eventDate === "string" && eventDate && typeof endTime === "string" && endTime) {
        formData.set("ends_at", new Date(`${eventDate}T${endTime}`).toISOString());
      } else {
        formData.delete("ends_at");
      }
      formData.delete("event_date");
      formData.delete("start_time");
      formData.delete("end_time");
    } else {
      const startsAt = formData.get("starts_at");
      if (typeof startsAt === "string" && startsAt) {
        formData.set("starts_at", new Date(startsAt).toISOString());
      }
      const endsAt = formData.get("ends_at");
      if (typeof endsAt === "string" && endsAt) {
        formData.set("ends_at", new Date(endsAt).toISOString());
      }
    }
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
        label={isEdit ? "설명" : <>설명 <OptionalMark /></>}
        placeholder="이벤트를 한두 문장으로 소개해요."
        defaultValue={event?.description}
        rows={3}
      />

      {DAY_TRIP_TYPES.includes(type) ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <DatePicker
            name="event_date"
            label={
              isEdit ? (
                "날짜"
              ) : (
                <>
                  날짜 <RequiredMark /> <OptionalMark>KST 기준</OptionalMark>
                </>
              )
            }
            defaultValue={event ? toKstDateOnly(event.starts_at) : (defaultDate ?? "")}
            required
          />
          <Input
            type="time"
            name="start_time"
            label={isEdit ? "시작 시간" : <>시작 시간 <RequiredMark /></>}
            defaultValue={
              event ? toKstTimeOnly(event.starts_at) : defaultDate ? DEFAULT_START_TIME : ""
            }
            required
          />
          <Input
            type="time"
            name="end_time"
            label={isEdit ? "종료 시간" : <>종료 시간 <OptionalMark /></>}
            defaultValue={event?.ends_at ? toKstTimeOnly(event.ends_at) : ""}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <DatePicker
            withTime
            name="starts_at"
            label={
              isEdit ? (
                "시작"
              ) : (
                <>
                  시작 <RequiredMark /> <OptionalMark>KST 기준</OptionalMark>
                </>
              )
            }
            defaultValue={
              event
                ? toKstDatetimeLocal(event.starts_at)
                : defaultDate
                  ? `${defaultDate}T${DEFAULT_START_TIME}`
                  : ""
            }
            required
          />
          <DatePicker
            withTime
            name="ends_at"
            label={isEdit ? "종료" : <>종료 <OptionalMark /></>}
            defaultValue={event?.ends_at ? toKstDatetimeLocal(event.ends_at) : ""}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          type="number"
          name="capacity"
          label={isEdit ? "정원" : <>정원 <OptionalMark>비우면 무제한</OptionalMark></>}
          placeholder="예) 30"
          min={1}
          defaultValue={event?.capacity ?? undefined}
        />
        <Select
          name="place_id"
          label={isEdit ? "장소" : <>장소 <OptionalMark /></>}
          defaultValue={event?.place_id ?? ""}
        >
          <option value="">장소 없음</option>
          {places.map((place) => (
            <option key={place.id} value={place.id}>
              {place.name}
            </option>
          ))}
        </Select>
        <Input
          name="speaker"
          label={isEdit ? "발표자" : <>발표자 <OptionalMark /></>}
          placeholder="예) 김도현"
          defaultValue={event?.speaker}
        />
      </div>
      <p className="-mt-2 text-xs text-gray-400">
        장소는{" "}
        <a href="/admin/places" className="text-primary hover:underline">
          장소 관리
        </a>
        에서 추가해요. 주소·지도는 선택한 장소에서 자동으로 채워져요.
      </p>

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
