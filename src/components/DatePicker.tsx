"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useDismiss } from "@/lib/useDismiss";

interface DatePickerProps {
  name?: string;
  label?: ReactNode;
  error?: string;
  /** "YYYY-MM-DD" (기본) 또는 withTime 이면 "YYYY-MM-DDTHH:mm" */
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  withTime?: boolean;
  min?: string;
  max?: string;
  onChange?: (value: string) => void;
  className?: string;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");

interface Ymd {
  y: number;
  m: number; // 1-12
  d: number;
}

function parse(value: string): { date: Ymd | null; time: string } {
  const [datePart = "", timePart = ""] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const date = y && m && d ? { y, m, d } : null;
  const time = /^\d{2}:\d{2}/.test(timePart) ? timePart.slice(0, 5) : "";
  return { date, time };
}

function serialize(date: Ymd | null, time: string, withTime: boolean): string {
  if (!date) return "";
  const base = `${date.y}-${pad(date.m)}-${pad(date.d)}`;
  return withTime ? `${base}T${time || "00:00"}` : base;
}

function display(date: Ymd | null, time: string, withTime: boolean): string {
  if (!date) return "";
  const base = `${date.y}. ${date.m}. ${date.d}.`;
  return withTime && time ? `${base} ${time}` : base;
}

export function DatePicker({
  name,
  label,
  error,
  defaultValue = "",
  required,
  disabled,
  withTime = false,
  min,
  max,
  onChange,
  className,
}: DatePickerProps) {
  const fieldId = useId();
  const init = parse(defaultValue);
  const today = new Date();

  const [date, setDate] = useState<Ymd | null>(init.date);
  const [time, setTime] = useState(init.time || (withTime ? "00:00" : ""));
  const [viewY, setViewY] = useState(init.date?.y ?? today.getFullYear());
  const [viewM, setViewM] = useState(init.date?.m ?? today.getMonth() + 1);

  const { ref, open, setOpen } = useDismiss<HTMLDivElement>();
  const hiddenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = hiddenRef.current?.form;
    if (!form) return;
    const onReset = () => {
      const fresh = parse(defaultValue);
      setDate(fresh.date);
      setTime(fresh.time || (withTime ? "00:00" : ""));
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [defaultValue, withTime]);

  const firstWeekday = new Date(viewY, viewM - 1, 1).getDay();
  const daysInMonth = new Date(viewY, viewM, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function move(delta: number) {
    let m = viewM + delta;
    let y = viewY;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewM(m);
    setViewY(y);
  }

  function pick(d: number) {
    const nextDate = { y: viewY, m: viewM, d };
    setDate(nextDate);
    onChange?.(serialize(nextDate, time, withTime));
    if (!withTime) setOpen(false);
  }

  function changeTime(nextTime: string) {
    setTime(nextTime);
    onChange?.(serialize(date, nextTime, withTime));
  }

  const isToday = (d: number) =>
    today.getFullYear() === viewY &&
    today.getMonth() + 1 === viewM &&
    today.getDate() === d;
  const isSelected = (d: number) =>
    date?.y === viewY && date?.m === viewM && date?.d === d;
  const isOutOfRange = (d: number) => {
    const value = serialize({ y: viewY, m: viewM, d }, "", false);
    return Boolean((min && value < min) || (max && value > max));
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={fieldId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div ref={ref} className="relative">
        {name && (
          <input
            ref={hiddenRef}
            type="hidden"
            name={name}
            value={serialize(date, time, withTime)}
            required={required}
          />
        )}
        <button
          id={fieldId}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-white dark:bg-gray-100 px-3 text-left text-sm focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:text-gray-400",
            date ? "text-gray-900" : "text-gray-400",
            error
              ? "border-danger focus:border-danger focus:ring-danger"
              : "border-gray-300 focus:border-primary focus:ring-primary",
            className,
          )}
        >
          <span className="truncate">
            {display(date, time, withTime) || "날짜 선택"}
          </span>
          <svg
            className="h-4 w-4 shrink-0 text-gray-400"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
          >
            <rect x="3" y="4" width="14" height="13" rx="2" />
            <path d="M3 8h14M7 2v3M13 2v3" strokeLinecap="round" />
          </svg>
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-64 rounded-md border border-gray-200 bg-white dark:bg-gray-100 p-3 shadow-card">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => move(-1)}
                className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100"
                aria-label="이전 달"
              >
                ‹
              </button>
              <span className="text-sm font-semibold text-gray-900">
                {viewY}. {viewM}
              </span>
              <button
                type="button"
                onClick={() => move(1)}
                className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100"
                aria-label="다음 달"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
              {WEEKDAYS.map((w) => (
                <span key={w} className="py-1 text-gray-400">
                  {w}
                </span>
              ))}
              {cells.map((d, i) =>
                d === null ? (
                  <span key={`e${i}`} />
                ) : (
                  <button
                    key={d}
                    type="button"
                    disabled={isOutOfRange(d)}
                    onClick={() => pick(d)}
                    className={cn(
                      "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm disabled:cursor-not-allowed disabled:text-gray-300",
                      isSelected(d)
                        ? "bg-primary font-semibold text-white"
                        : isToday(d)
                          ? "font-semibold text-primary hover:bg-primary-soft"
                          : "text-gray-700 hover:bg-gray-100",
                    )}
                  >
                    {d}
                  </button>
                ),
              )}
            </div>
            {withTime && (
              <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
                <span className="text-sm text-gray-500">시간</span>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => changeTime(e.target.value)}
                  className="h-9 flex-1 rounded-md border border-gray-300 px-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
