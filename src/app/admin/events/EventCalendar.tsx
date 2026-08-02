"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moveEvent } from "@/actions/event";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import {
  diffDays,
  monthGrid,
  shiftMonth,
  weekdayLabel,
  WEEKDAY_LABELS,
} from "@/lib/calendar";
import { cn } from "@/lib/cn";
import {
  EVENT_TYPE_BG,
  EVENT_TYPE_CHIP,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_OPTIONS,
} from "@/lib/event-type";
import { dayKeyKst, formatMonthLabel, timeKeyKst } from "@/lib/format";
import type { Event, EventType, Place } from "@/lib/types";
import { DeleteEventButton } from "./DeleteEventButton";
import { EventForm } from "./EventForm";

/** 면접 슬롯은 달력에 표시만 한다. 수정은 /admin/interviews에서. */
export interface CalendarInterview {
  id: string;
  starts_at: string;
  status: string;
}

/** 확정된 회의 시간도 표시만 한다. 수정은 /schedule에서. */
export interface CalendarMeeting {
  id: string;
  title: string;
  starts_at: string;
  duration_min: number;
}

type Editing =
  | { mode: "create"; date: string }
  | { mode: "edit"; event: Event }
  | null;

/** 툴바 유형 필터. null이면 전체. */
type Filter = EventType | "interview" | "meeting" | null;

interface EventCalendarProps {
  month: string;
  events: Event[];
  interviews: CalendarInterview[];
  meetings: CalendarMeeting[];
  places: Place[];
  /** 서버에서 계산한 오늘(KST). 클라이언트에서 구하면 하이드레이션이 어긋난다. */
  today: string;
  /** 데모 모드에서는 쓰기가 막혀 있어 편집 UI를 열지 않는다. */
  readOnly?: boolean;
}

function groupByDay<T extends { starts_at: string }>(items: T[]) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = dayKeyKst(item.starts_at);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }
  return map;
}

function MonthArrow({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d={d} />
    </svg>
  );
}

/** 유형 칩·요약·어젠다에 공통으로 쓰는 8px 색 사각형. */
function TypeDot({ className }: { className: string }) {
  return <span className={cn("h-2 w-2 flex-none rounded-[2px]", className)} />;
}

const CHIP_BASE =
  "inline-flex h-8 flex-none items-center gap-1.5 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-colors duration-100";

export function EventCalendar({
  month,
  events,
  interviews,
  meetings,
  places,
  today,
  readOnly = false,
}: EventCalendarProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const days = monthGrid(month);
  const eventsByDay = groupByDay(events);
  const interviewsByDay = groupByDay(interviews);
  const meetingsByDay = groupByDay(meetings);

  // 툴바·요약은 이번 달만 센다. 격자에는 앞뒤 달 날짜도 섞여 있다.
  const monthEvents = events.filter((e) => dayKeyKst(e.starts_at).startsWith(month));
  const monthInterviews = interviews.filter((s) =>
    dayKeyKst(s.starts_at).startsWith(month),
  );
  const monthMeetings = meetings.filter((m) => dayKeyKst(m.starts_at).startsWith(month));
  const countByType = new Map<EventType, number>();
  for (const e of monthEvents) {
    countByType.set(e.type, (countByType.get(e.type) ?? 0) + 1);
  }
  const legend = [
    ...EVENT_TYPE_OPTIONS.filter((o) => countByType.has(o.value)).map((o) => ({
      key: o.value as Filter,
      label: o.label,
      dot: EVENT_TYPE_BG[o.value],
      count: countByType.get(o.value) ?? 0,
      dashed: false,
    })),
    ...(monthInterviews.length > 0
      ? [
          {
            key: "interview" as Filter,
            label: "면접",
            dot: "bg-gray-400",
            count: monthInterviews.length,
            dashed: true,
          },
        ]
      : []),
    ...(monthMeetings.length > 0
      ? [
          {
            key: "meeting" as Filter,
            label: "회의",
            dot: "bg-primary/60",
            count: monthMeetings.length,
            dashed: true,
          },
        ]
      : []),
  ];
  const totalCount = monthEvents.length + monthInterviews.length + monthMeetings.length;

  // 다가오는 일정: 오늘 이후만, 면접은 날짜별로 한 줄로 묶는다.
  const upcoming = [
    ...events
      .filter((e) => dayKeyKst(e.starts_at) >= today)
      .map((e) => ({
        key: e.id,
        dateKey: dayKeyKst(e.starts_at),
        sortKey: e.starts_at,
        dot: EVENT_TYPE_BG[e.type],
        title: e.title,
        muted: false,
        meta: [timeKeyKst(e.starts_at), e.location].filter(Boolean).join(" · "),
        href: `/admin/events/${e.id}`,
      })),
    ...[...interviewsByDay.entries()]
      .filter(([dateKey]) => dateKey >= today)
      .map(([dateKey, slots]) => {
        const booked = slots.filter((s) => s.status === "booked").length;
        return {
          key: `interview-${dateKey}`,
          dateKey,
          sortKey: slots[0].starts_at,
          dot: "bg-gray-400",
          title: `면접${booked > 0 ? " · 예약" : ""} ${slots.length}건`,
          muted: true,
          meta: `${timeKeyKst(slots[0].starts_at)} · 표시 전용`,
          href: "/admin/interviews",
        };
      }),
    ...meetings
      .filter((m) => dayKeyKst(m.starts_at) >= today)
      .map((m) => ({
        key: `meeting-${m.id}`,
        dateKey: dayKeyKst(m.starts_at),
        sortKey: m.starts_at,
        dot: "bg-primary/60",
        title: m.title,
        muted: true,
        meta: `${timeKeyKst(m.starts_at)} · 회의 ${m.duration_min}분`,
        href: `/schedule/${m.id}`,
      })),
  ]
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .slice(0, 5);

  function handleDrop(dateKey: string, eventId: string) {
    setDragOver(null);
    const moved = events.find((e) => e.id === eventId);
    if (!moved || dayKeyKst(moved.starts_at) === dateKey) return;

    setError(undefined);
    startTransition(async () => {
      const result = await moveEvent(eventId, dateKey);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  const monthHref = (value: string) => `/admin/events?view=calendar&month=${value}`;

  return (
    <div className="flex flex-col gap-3">
      {/* 모바일은 [월 이동][오늘] 한 줄 + 필터 한 줄, 데스크톱은 한 줄에 모두. order로 순서만 바꾼다. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <div className="order-first flex flex-1 items-center gap-0.5 md:order-none md:flex-none">
          <Link
            href={monthHref(shiftMonth(month, -1))}
            aria-label="이전 달"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 active:bg-gray-200"
          >
            <MonthArrow d="M12 5l-5 5 5 5" />
          </Link>
          <h2 className="min-w-32 text-center text-base font-semibold whitespace-nowrap text-gray-900">
            {formatMonthLabel(month)}
          </h2>
          <Link
            href={monthHref(shiftMonth(month, 1))}
            aria-label="다음 달"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 active:bg-gray-200"
          >
            <MonthArrow d="M8 5l5 5-5 5" />
          </Link>
        </div>

        {legend.length > 0 && (
          <>
            <div className="hidden h-5 w-px bg-gray-200 md:block" aria-hidden />
            <div
              // min-w-0: 칩이 툴바를 밀어내지 않고 자기 안에서만 가로 스크롤되게 한다.
              className="no-scrollbar flex w-full min-w-0 items-center gap-1.5 overflow-x-auto md:w-auto md:flex-wrap md:overflow-visible"
              role="group"
              aria-label="유형 필터"
            >
              <button
                type="button"
                onClick={() => setFilter(null)}
                aria-pressed={filter === null}
                className={cn(
                  CHIP_BASE,
                  filter === null
                    ? "bg-primary-soft text-primary font-semibold"
                    : "border border-gray-300 text-gray-600 hover:bg-gray-50",
                )}
              >
                전체 {totalCount}
              </button>
              {legend.map((item) => {
                const active = filter === item.key;
                return (
                  <button
                    key={String(item.key)}
                    type="button"
                    onClick={() => setFilter(active ? null : item.key)}
                    aria-pressed={active}
                    className={cn(
                      CHIP_BASE,
                      "border",
                      item.dashed ? "border-dashed" : "border-solid",
                      active
                        ? "border-primary bg-primary-soft text-primary font-semibold"
                        : cn(
                            "border-gray-300 hover:bg-gray-50",
                            item.dashed ? "text-gray-500" : "text-gray-600",
                          ),
                    )}
                  >
                    <TypeDot className={item.dot} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <Link
          href={monthHref(today.slice(0, 7))}
          className="order-first ml-auto inline-flex h-8 flex-none items-center rounded-md border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 md:order-none dark:bg-gray-100"
        >
          오늘
        </Link>
      </div>

      {error && (
        <p className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          {/* 모바일은 테두리 없는 컴팩트 월(날짜 + 유형 점), md부터 칸에 일정 칩이 들어가는 격자. */}
          <div
            className={cn(
              "px-2 transition-opacity md:overflow-hidden md:rounded-xl md:border md:border-gray-300 md:px-0",
              pending && "opacity-60",
            )}
          >
            <div className="grid grid-cols-7 md:border-b md:border-gray-300 md:bg-gray-100">
              {WEEKDAY_LABELS.map((label, i) => (
                <div
                  key={label}
                  className={cn(
                    "pb-2 text-center text-[11px] font-semibold md:py-2 md:text-xs",
                    i === 0 ? "text-danger" : i === 6 ? "text-primary" : "text-gray-600",
                  )}
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {days.map((dateKey, i) => {
                const inMonth = dateKey.startsWith(month);
                const isToday = dateKey === today;
                const dayEvents = (eventsByDay.get(dateKey) ?? []).filter(
                  (e) => filter === null || filter === e.type,
                );
                const dayInterviews =
                  filter === null || filter === "interview"
                    ? (interviewsByDay.get(dateKey) ?? [])
                    : [];
                const dayMeetings =
                  filter === null || filter === "meeting"
                    ? (meetingsByDay.get(dateKey) ?? [])
                    : [];
                const isDropTarget = dragOver === dateKey;

                return (
                  <div
                    key={dateKey}
                    onDragOver={(e) => {
                      if (readOnly) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setDragOver(dateKey);
                    }}
                    onDragLeave={() => setDragOver((d) => (d === dateKey ? null : d))}
                    onDrop={(e) => {
                      if (readOnly) return;
                      e.preventDefault();
                      handleDrop(dateKey, e.dataTransfer.getData("text/plain"));
                    }}
                    className={cn(
                      "flex h-[46px] flex-col items-center gap-1 border-gray-200 md:h-auto md:items-stretch md:p-1.5",
                      // 마지막 주는 대개 다음 달 날짜뿐이라 낮게 눌러 격자 무게를 줄인다.
                      i >= 35 ? "md:min-h-16" : "md:min-h-28",
                      i % 7 !== 6 && "md:border-r",
                      i < 35 && "md:border-b",
                      // cn이 단순 join이라 배경은 겹치면 안 된다. 하나만 고르도록 삼항으로.
                      // 모바일 컴팩트 월은 칸 배경을 쓰지 않아 md부터만 칠한다.
                      isDropTarget
                        ? "md:bg-primary-soft md:ring-1 md:ring-primary md:ring-inset"
                        : isToday
                          ? "md:bg-primary/[0.04]"
                          : inMonth
                            ? "md:bg-white md:dark:bg-gray-100"
                            : "md:bg-gray-50",
                    )}
                  >
                    <span
                      className={cn(
                        "self-center rounded-full text-sm font-semibold tabular-nums md:self-start md:px-1.5",
                        isToday
                          ? "flex h-6 w-6 items-center justify-center bg-primary text-white md:h-auto md:w-auto"
                          : inMonth
                            ? "text-gray-800"
                            : "text-gray-400",
                      )}
                    >
                      {Number(dateKey.slice(8))}
                    </span>

                    {(dayEvents.length > 0 ||
                      dayInterviews.length > 0 ||
                      dayMeetings.length > 0) && (
                      <span className="flex gap-[3px] md:hidden" aria-hidden>
                        {[...new Set(dayEvents.map((e) => e.type))].map((type) => (
                          <span
                            key={type}
                            className={cn(
                              "h-[5px] w-[5px] rounded-full",
                              EVENT_TYPE_BG[type],
                            )}
                          />
                        ))}
                        {dayInterviews.length > 0 && (
                          <span className="h-[5px] w-[5px] rounded-full bg-gray-400" />
                        )}
                        {dayMeetings.length > 0 && (
                          <span className="h-[5px] w-[5px] rounded-full bg-primary/60" />
                        )}
                      </span>
                    )}

                    {isDropTarget && (
                      <div className="hidden h-[42px] items-center rounded border border-dashed border-primary bg-primary/[0.06] px-[7px] text-xs font-semibold text-primary md:flex">
                        여기로 이동
                      </div>
                    )}

                    {dayEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        draggable={!readOnly}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", event.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={() => setEditing({ mode: "edit", event })}
                        title={`${EVENT_TYPE_LABELS[event.type]} · ${event.title}`}
                        className={cn(
                          "hidden w-full flex-col rounded-r-[4px] border-l-[3px] py-1 pr-1.5 pl-[7px] text-left md:flex",
                          EVENT_TYPE_CHIP[event.type],
                          !readOnly && "cursor-grab active:cursor-grabbing",
                        )}
                      >
                        <span className="flex w-full items-baseline gap-[5px]">
                          <span className="flex-none text-xs tabular-nums text-gray-500">
                            {timeKeyKst(event.starts_at)}
                          </span>
                          <span className="truncate text-[13px] font-semibold text-gray-900">
                            {event.title}
                          </span>
                        </span>
                        {event.location && (
                          <span className="w-full truncate text-[11.5px] text-gray-500">
                            {event.location}
                          </span>
                        )}
                      </button>
                    ))}

                    {dayInterviews.map((slot) => (
                      <Link
                        key={slot.id}
                        href="/admin/interviews"
                        // 링크는 기본이 draggable이라 끌 수 있는 것처럼 보인다. 면접은 못 옮기니 꺼 둔다.
                        draggable={false}
                        title={`면접 ${slot.status === "booked" ? "예약" : "열림"}`}
                        className="hidden w-full flex-col rounded-r-[4px] border-l-[3px] border-l-gray-400 border-dashed bg-gray-100/60 py-1 pr-1.5 pl-[7px] hover:bg-gray-100 md:flex"
                      >
                        <span className="flex w-full items-baseline gap-[5px]">
                          <span className="flex-none text-xs tabular-nums text-gray-500">
                            {timeKeyKst(slot.starts_at)}
                          </span>
                          <span className="truncate text-[13px] font-semibold text-gray-700">
                            면접{slot.status === "booked" ? " · 예약" : ""}
                          </span>
                        </span>
                        <span className="w-full truncate text-[11.5px] text-gray-400">
                          표시 전용
                        </span>
                      </Link>
                    ))}

                    {dayMeetings.map((meeting) => (
                      <Link
                        key={meeting.id}
                        href={`/schedule/${meeting.id}`}
                        draggable={false}
                        title={`회의 · ${meeting.title}`}
                        className="hidden w-full flex-col rounded-r-[4px] border-l-[3px] border-l-primary/60 border-dashed bg-primary-soft/60 py-1 pr-1.5 pl-[7px] hover:bg-primary-soft md:flex"
                      >
                        <span className="flex w-full items-baseline gap-[5px]">
                          <span className="flex-none text-xs tabular-nums text-gray-500">
                            {timeKeyKst(meeting.starts_at)}
                          </span>
                          <span className="truncate text-[13px] font-semibold text-gray-800">
                            회의
                          </span>
                        </span>
                        <span className="w-full truncate text-[11.5px] text-gray-500">
                          {meeting.title}
                        </span>
                      </Link>
                    ))}

                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => setEditing({ mode: "create", date: dateKey })}
                        aria-label={`${dateKey}에 이벤트 추가`}
                        className="group hidden min-h-6 flex-1 rounded text-left hover:bg-gray-100 md:block"
                      >
                        <span className="px-[7px] text-xs text-gray-400 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
                          ＋ 추가
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 드래그 이동은 마우스 전용이라 컴팩트 월에서는 안내도 감춘다. */}
          <p className="hidden text-xs text-gray-400 md:block">
            일정을 다른 날짜로 끌어다 놓으면 시각은 그대로 두고 날짜만 바뀌어요. 면접
            일정은 표시만 되고, 수정은{" "}
            <Link href="/admin/interviews" className="text-primary hover:underline">
              면접 일정
            </Link>
            에서 해요.
          </p>
        </div>

        <aside className="flex w-full flex-col gap-3 xl:w-[300px] xl:flex-none">
          {/* 모바일에서 월 격자와 어젠다를 가르는 두꺼운 회색 띠. */}
          <div className="h-2 bg-gray-100 md:hidden" aria-hidden />

          <div className="overflow-hidden md:rounded-xl md:border md:border-gray-200 md:bg-white md:shadow-card md:dark:bg-gray-100">
            <div className="flex items-center justify-between pb-2.5 md:px-4 md:pt-3.5">
              <h3 className="text-[15px] font-bold text-gray-900">다가오는 일정</h3>
              <span className="hidden text-xs text-gray-500 md:inline">
                {upcoming.length}건
              </span>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-[13px] text-gray-500 md:border-t md:border-gray-100 md:px-4 md:py-3">
                다가오는 일정이 없어요.
              </p>
            ) : (
              <div className="grid gap-2 md:block md:gap-0">
                {upcoming.map((item) => {
                  const dday = diffDays(today, item.dateKey);
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={cn(
                        // 모바일은 카드 한 장씩, md부터는 패널 안 구분선 행.
                        "flex items-center gap-3 rounded-lg border px-3 py-3 md:items-stretch md:rounded-none md:border-x-0 md:border-b-0 md:border-t md:px-4 md:hover:bg-gray-50",
                        item.muted
                          ? "border-dashed border-gray-300 bg-gray-50 md:border-solid md:border-gray-100 md:bg-transparent"
                          : "border-gray-200 md:border-gray-100",
                      )}
                    >
                      <span className="w-9 flex-none text-center">
                        <span
                          className={cn(
                            "block text-[17px] font-bold tabular-nums",
                            item.muted ? "text-gray-700" : "text-gray-900",
                          )}
                        >
                          {Number(item.dateKey.slice(8))}
                        </span>
                        <span className="block text-[11px] text-gray-500">
                          {weekdayLabel(item.dateKey)}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <TypeDot className={item.dot} />
                          <span
                            className={cn(
                              "truncate text-sm font-semibold",
                              item.muted ? "text-gray-700" : "text-gray-900",
                            )}
                          >
                            {item.title}
                          </span>
                        </span>
                        <span className="mt-[3px] block truncate text-[12.5px] text-gray-500">
                          {item.meta}
                        </span>
                      </span>
                      <span className="inline-flex h-5 flex-none items-center self-center rounded-md bg-gray-100 px-1.5 text-[11px] font-semibold text-gray-600">
                        {dday === 0 ? "오늘" : `D-${dday}`}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* 요약·안내는 모바일에서 스크롤만 늘리므로 md부터 보여준다. */}
          <Card className="hidden !px-4 !py-3.5 md:block">
            <h3 className="mb-2.5 text-[15px] font-bold text-gray-900">이번 달 요약</h3>
            {legend.length === 0 ? (
              <p className="text-[13px] text-gray-500">이번 달 일정이 없어요.</p>
            ) : (
              <div className="grid gap-2">
                {legend.map((item) => (
                  <div
                    key={String(item.key)}
                    className={cn(
                      "flex items-center justify-between text-[13px]",
                      item.dashed ? "text-gray-500" : "text-gray-600",
                    )}
                  >
                    <span className="flex items-center gap-[7px]">
                      <TypeDot className={item.dot} />
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        "font-semibold",
                        item.dashed ? "" : "text-gray-900",
                      )}
                    >
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {!readOnly && (
            <p className="hidden rounded-xl bg-primary-soft px-4 py-3.5 text-[13px] leading-relaxed font-semibold text-primary md:block">
              빈 날짜를 클릭하면 그 날짜가 채워진 생성 모달이 열려요.
            </p>
          )}
        </aside>
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        ariaLabel={editing?.mode === "edit" ? "이벤트 수정" : "이벤트 생성"}
        className="max-w-3xl"
      >
        {editing && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-base font-semibold text-gray-900">
                {editing.mode === "edit" ? "이벤트 수정" : `${editing.date} 이벤트 생성`}
              </h2>
              <div className="flex items-center gap-2">
                {editing.mode === "edit" && (
                  <Link
                    href={`/admin/events/${editing.event.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    상세
                  </Link>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(null)}
                >
                  닫기
                </Button>
              </div>
            </div>

            <EventForm
              key={editing.mode === "edit" ? editing.event.id : editing.date}
              event={editing.mode === "edit" ? editing.event : undefined}
              defaultDate={editing.mode === "create" ? editing.date : undefined}
              places={places}
              onSuccess={() => setEditing(null)}
            />

            {editing.mode === "edit" && (
              <div className="border-t border-gray-200 pt-4">
                <DeleteEventButton
                  eventId={editing.event.id}
                  onDeleted={() => setEditing(null)}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
