"use client";

import type { ReactNode } from "react";
import { Avatar } from "@/components/wds/Avatar";
import type { ParticipantView } from "@/lib/meeting-poll";

export function MetaChip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 28,
        padding: "0 10px",
        borderRadius: 8,
        background: "var(--wds-bg)",
        boxShadow: "inset 0 0 0 1px var(--wds-line-alternative)",
      }}
    >
      <span style={{ font: "500 12px/1 var(--wds-font-sans)", color: "var(--wds-label-assistive)" }}>
        {label}
      </span>
      <span style={{ font: "600 13px/1 var(--wds-font-sans)", color: "var(--wds-label-normal)" }}>
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
  strike = false,
  pending = false,
}: {
  label: string;
  labelColor: string;
  people: ParticipantView[];
  strike?: boolean;
  pending?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 44, flexShrink: 0, font: "500 12px/1.4 var(--wds-font-sans)", color: labelColor }}>
        {label}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {people.length === 0 && (
          <span style={{ font: "400 13px/1.4 var(--wds-font-sans)", color: "var(--wds-label-assistive)" }}>
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
              height: 28,
              padding: "0 10px 0 4px",
              borderRadius: 999,
              background: strike || pending ? "transparent" : "var(--wds-bg)",
              boxShadow: "inset 0 0 0 1px var(--wds-line-alternative)",
            }}
          >
            {pending ? (
              <Avatar initial={person.initial} size={20} pending avatarPath={person.avatarPath} />
            ) : (
              <Avatar
                initial={person.initial}
                color={strike ? "var(--wds-fill-strong)" : person.color}
                size={20}
                avatarPath={strike ? null : person.avatarPath}
                style={strike ? { color: "var(--wds-label-alternative)" } : undefined}
              />
            )}
            <span
              style={{
                font: "500 13px/1 var(--wds-font-sans)",
                color: pending
                  ? "var(--wds-label-assistive)"
                  : strike
                    ? "var(--wds-label-alternative)"
                    : "var(--wds-label-neutral)",
                textDecoration: strike ? "line-through" : undefined,
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
