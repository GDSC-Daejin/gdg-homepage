import type { EventType } from "@/lib/types";

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  session: "정기세션",
  study: "스터디",
  mogakco: "모각코",
  party: "파티",
};

export const EVENT_TYPE_OPTIONS: { value: EventType; label: string }[] = (
  Object.keys(EVENT_TYPE_LABELS) as EventType[]
).map((value) => ({ value, label: EVENT_TYPE_LABELS[value] }));

export const EVENT_TYPE_TONES: Record<
  EventType,
  "primary" | "success" | "warning" | "danger"
> = {
  session: "primary",
  study: "success",
  mogakco: "warning",
  party: "danger",
};

/** 배지 막대·라디오 점 등 단색 배경. */
export const EVENT_TYPE_BG: Record<EventType, string> = {
  session: "bg-primary",
  study: "bg-success",
  mogakco: "bg-warning",
  party: "bg-danger",
};

export const EVENT_TYPE_TEXT: Record<EventType, string> = {
  session: "text-primary",
  study: "text-success",
  mogakco: "text-warning",
  party: "text-danger",
};

/** 유형 선택 라디오의 선택 상태. */
export const EVENT_TYPE_SELECTED: Record<EventType, string> = {
  session: "border-primary bg-primary-soft text-primary",
  study: "border-success bg-success-soft text-success",
  mogakco: "border-warning bg-warning-soft text-warning",
  party: "border-danger bg-danger-soft text-danger",
};

/**
 * 달력 칸 안의 작은 일정 칩. 색은 왼쪽 막대로만 쓰고 글자는 gray-900으로 읽는다.
 * soft 배경에 원색 글씨를 얹으면 흰 캔버스에서 칩이 통째로 흐려진다.
 */
export const EVENT_TYPE_CHIP: Record<EventType, string> = {
  session: "border-l-primary bg-primary-soft/50",
  study: "border-l-success bg-success-soft/50",
  mogakco: "border-l-warning bg-warning-soft/50",
  party: "border-l-danger bg-danger-soft/50",
};
