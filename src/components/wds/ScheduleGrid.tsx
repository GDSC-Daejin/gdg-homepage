"use client";

import { Fragment, type CSSProperties, type ReactNode } from "react";
import { shortDate, weekdayColor, weekdayKo, type Cell } from "@/lib/meeting-poll";

/**
 * 조율 격자. 원본 목업의 치수를 그대로 옮겼다 —
 * 라벨 열 52px, 칸 높이 26px, 정시 경계만 line-neutral로 진하게.
 * 미리보기(오른쪽 레일)는 34px / 17px / 시(hour) 숫자만 쓰는 변형이다.
 */
export interface ScheduleGridProps {
  dates: string[];
  times: string[];
  slotMin: number;
  /** 칸 배경·링·z-index·안에 그릴 것 */
  cell: (cell: Cell) => {
    background: string;
    boxShadow?: string;
    zIndex?: number;
    content?: ReactNode;
  };
  labelWidth?: number;
  rowHeight?: number;
  /** time = "18:00", short = "18", none = 라벨 없음 */
  labelKind?: "time" | "short" | "none";
  /** full = 날짜+요일, weekday = 요일만 */
  header?: "full" | "weekday";
  interactive?: boolean;
  onCellPointerDown?: (e: React.PointerEvent, cell: Cell) => void;
  onCellPointerEnter?: (cell: Cell) => void;
  onCellClick?: (cell: Cell) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: () => void;
  onPointerCancel?: () => void;
  onPointerLeave?: () => void;
  style?: CSSProperties;
}

export function ScheduleGrid({
  dates,
  times,
  slotMin,
  cell,
  labelWidth = 52,
  rowHeight = 26,
  labelKind = "time",
  header = "full",
  interactive = false,
  onCellPointerDown,
  onCellPointerEnter,
  onCellClick,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  style,
}: ScheduleGridProps) {
  const isHourEnd = (index: number) => {
    const [h, m] = times[index].split(":").map(Number);
    return (h * 60 + m + slotMin) % 60 === 0;
  };
  const label = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    if (labelKind === "none" || m !== 0) return "";
    return labelKind === "short" ? String(h) : `${h}:00`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, ...style }}>
      <div style={{ display: "flex" }}>
        <div style={{ width: labelWidth, flexShrink: 0 }} />
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: `repeat(${dates.length}, 1fr)`,
          }}
        >
          {dates.map((date) =>
            header === "full" ? (
              <div
                key={date}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1,
                  paddingBottom: 8,
                }}
              >
                <span
                  style={{
                    font: "400 12px/1.3 var(--wds-font-sans)",
                    color: "var(--wds-label-alternative)",
                  }}
                >
                  {shortDate(date)}
                </span>
                <span
                  style={{
                    font: "700 14px/1.3 var(--wds-font-sans)",
                    color: weekdayColor(date),
                  }}
                >
                  {weekdayKo(date)}
                </span>
              </div>
            ) : (
              <div
                key={date}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingBottom: 6,
                  font: "700 11px/1.3 var(--wds-font-sans)",
                  color: weekdayColor(date),
                }}
              >
                {weekdayKo(date)}
              </div>
            ),
          )}
        </div>
      </div>

      <div style={{ display: "flex" }}>
        <div
          style={{
            width: labelWidth,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {times.map((time) => (
            <div
              key={time}
              style={{
                height: rowHeight,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: labelKind === "short" ? 6 : 8,
                font:
                  labelKind === "short"
                    ? "400 10px/1 var(--wds-font-sans)"
                    : "400 12px/1 var(--wds-font-sans)",
                color:
                  labelKind === "short"
                    ? "var(--wds-label-assistive)"
                    : "var(--wds-label-alternative)",
              }}
            >
              {label(time)}
            </div>
          ))}
        </div>

        <div
          // touch-none: 손가락으로 끌 때 페이지가 같이 스크롤되지 않게.
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: `repeat(${dates.length}, 1fr)`,
            borderTop: "1px solid var(--wds-line-neutral)",
            borderLeft: "1px solid var(--wds-line-alternative)",
            touchAction: interactive ? "none" : undefined,
            userSelect: interactive ? "none" : undefined,
          }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={onPointerLeave}
        >
          {times.map((time, ti) => (
            <Fragment key={time}>
              {dates.map((date, di) => {
                const deco = cell({ dateIndex: di, timeIndex: ti });
                return (
                  <div
                    key={`${date}-${time}`}
                    data-cell
                    data-di={di}
                    data-ti={ti}
                    onPointerDown={(e) =>
                      onCellPointerDown?.(e, { dateIndex: di, timeIndex: ti })
                    }
                    onPointerEnter={() =>
                      onCellPointerEnter?.({ dateIndex: di, timeIndex: ti })
                    }
                    onClick={() => onCellClick?.({ dateIndex: di, timeIndex: ti })}
                    style={{
                      position: "relative",
                      height: rowHeight,
                      borderRight: "1px solid var(--wds-line-alternative)",
                      borderBottom: isHourEnd(ti)
                        ? "1px solid var(--wds-line-neutral)"
                        : "1px solid var(--wds-line-alternative)",
                      background: deco.background,
                      boxShadow: deco.boxShadow,
                      zIndex: deco.zIndex,
                      cursor: interactive ? "pointer" : undefined,
                    }}
                  >
                    {deco.content}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 격자 좌표를 화면 좌표에서 찾아낸다. 터치 드래그는 pointerenter가 안 와서 이 방식이 필요하다. */
export function cellFromPoint(x: number, y: number): Cell | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-cell]");
  if (!el) return null;
  return { dateIndex: Number(el.dataset.di), timeIndex: Number(el.dataset.ti) };
}
