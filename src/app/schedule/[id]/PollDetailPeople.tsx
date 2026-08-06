"use client";

import type { ReactNode } from "react";
import { Avatar } from "@/components/wds/Avatar";
import type { ParticipantView } from "@/lib/meeting-poll";

export function MetaChip({
  label,
  children,
  icon,
  emphasis = false,
  horizontal = false,
  className,
}: {
  label: string;
  children: ReactNode;
  icon?: ReactNode;
  emphasis?: boolean;
  horizontal?: boolean;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        flexDirection: horizontal ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: horizontal ? 14 : 10,
        minHeight: horizontal ? 72 : 132,
        padding: "22px 28px",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10, whiteSpace: "nowrap", font: "600 16px/1.2 var(--wds-font-sans)", color: emphasis ? "var(--wds-primary)" : "var(--wds-label-alternative)" }}>
        {icon}
        {label}
      </span>
      <span style={{ whiteSpace: "nowrap", font: "700 22px/1.25 var(--wds-font-sans)", color: emphasis ? "var(--wds-primary)" : "var(--wds-label-normal)" }}>
        {children}
      </span>
    </span>
  );
}

export function PeopleTooltip({
  people,
  align,
  below,
  max = 8,
}: {
  people: ParticipantView[];
  align: "start" | "center" | "end";
  below: boolean;
  max?: number;
}) {
  const shown = people.slice(0, max);
  return (
    <div
      style={{
        position: "absolute",
        ...(below ? { top: "calc(100% + 6px)" } : { bottom: "calc(100% + 6px)" }),
        ...(align === "start"
          ? { left: 0 }
          : align === "end"
            ? { right: 0 }
            : { left: "50%", transform: "translateX(-50%)" }),
        zIndex: 30,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "10px 12px",
        borderRadius: 12,
        background: "var(--wds-bg)",
        boxShadow: "var(--wds-shadow-card), 0 0 0 1px var(--wds-line-alternative)",
        whiteSpace: "nowrap",
      }}
    >
      {shown.map((person) => (
        <div key={person.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar initial={person.initial} color={person.color} size={24} avatarPath={person.avatarPath} />
          <span style={{ font: "500 13px/1.4 var(--wds-font-sans)", color: "var(--wds-label-normal)" }}>
            {person.name}
          </span>
        </div>
      ))}
      {people.length > shown.length && (
        <span style={{ font: "400 12px/1.4 var(--wds-font-sans)", color: "var(--wds-label-alternative)" }}>
          외 {people.length - shown.length}명
        </span>
      )}
    </div>
  );
}

export function PersonRow({
  label,
  labelColor,
  people,
  count,
  strike = false,
  pending = false,
}: {
  label: string;
  labelColor: string;
  people: ParticipantView[];
  count: number;
  strike?: boolean;
  pending?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 20, padding: "18px 22px", borderTop: "1px solid var(--wds-line-alternative)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, width: 92, flexShrink: 0 }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: labelColor }} />
        <span style={{ font: "700 16px/1.4 var(--wds-font-sans)", color: labelColor }}>
          {label}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 28, height: 28, padding: "0 8px", borderRadius: 999, background: "var(--wds-bg-alt)", font: "700 14px/1 var(--wds-font-sans)", color: labelColor }}>
          {count}
        </span>
      </div>
      <div style={{ display: "flex", flex: 1, flexWrap: "wrap", gap: 8 }}>
        {people.length === 0 && (
          <span style={{ font: "400 14px/1.8 var(--wds-font-sans)", color: "var(--wds-label-assistive)" }}>
            없음
          </span>
        )}
        {people.map((person) => (
          <span
            key={person.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 32,
              padding: "0 12px 0 4px",
              borderRadius: 999,
              background: "var(--wds-bg-elevated)",
              boxShadow: "inset 0 0 0 1px var(--wds-line-alternative)",
            }}
          >
            {pending ? (
              <Avatar initial={person.initial} size={24} pending avatarPath={person.avatarPath} />
            ) : (
              <Avatar
                initial={person.initial}
                color={strike ? "var(--wds-fill-strong)" : person.color}
                size={24}
                avatarPath={strike ? null : person.avatarPath}
                style={strike ? { color: "var(--wds-label-alternative)" } : undefined}
              />
            )}
            <span
              style={{
                font: "600 14px/1 var(--wds-font-sans)",
                color: pending || strike ? "var(--wds-label-alternative)" : "var(--wds-label-neutral)",
              }}
            >
              {person.name}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
