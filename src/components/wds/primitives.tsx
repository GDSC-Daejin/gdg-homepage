"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Icon, type WdsIconName } from "./Icon";

/**
 * WDS 나머지 컴포넌트 이식 — ContentBadge · ProgressBar · Chip · TextField ·
 * SelectBox · SegmentedControl · Switch · Callout.
 * 값은 모두 원본 _ds_bundle.js 그대로다.
 */

/* ---------------- ContentBadge ---------------- */

type BadgeColor = "primary" | "neutral" | "red" | "orange" | "green" | "cyan" | "violet";
type BadgeSize = "xsmall" | "small" | "medium";

const BADGE_SIZES: Record<BadgeSize, { height: number; padX: number; font: number; radius: number }> = {
  xsmall: { height: 18, padX: 5, font: 11, radius: 4 },
  small: { height: 20, padX: 6, font: 11, radius: 4 },
  medium: { height: 24, padX: 7, font: 12, radius: 6 },
};

const BADGE_COLORS: Record<BadgeColor, { fg: string; bg: string }> = {
  primary: { fg: "var(--wds-primary-strong)", bg: "rgba(0,102,255,0.10)" },
  neutral: { fg: "var(--wds-label-neutral)", bg: "var(--wds-fill-normal)" },
  red: { fg: "var(--wds-accent-red)", bg: "rgba(255,66,66,0.10)" },
  orange: { fg: "var(--wds-accent-orange)", bg: "rgba(255,153,0,0.12)" },
  green: { fg: "var(--wds-accent-green)", bg: "rgba(0,191,64,0.10)" },
  cyan: { fg: "var(--wds-accent-cyan)", bg: "rgba(0,152,178,0.10)" },
  violet: { fg: "var(--wds-accent-violet)", bg: "rgba(101,65,242,0.10)" },
};

export function ContentBadge({
  children,
  variant = "solid",
  color = "primary",
  size = "small",
  style,
}: {
  children: ReactNode;
  variant?: "solid" | "outlined";
  color?: BadgeColor;
  size?: BadgeSize;
  style?: CSSProperties;
}) {
  const s = BADGE_SIZES[size];
  const c = BADGE_COLORS[color];
  const solid = variant === "solid";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: s.height,
        padding: `0 ${s.padX}px`,
        boxSizing: "border-box",
        borderRadius: s.radius,
        backgroundColor: solid ? c.bg : "transparent",
        boxShadow: solid ? "none" : `inset 0 0 0 1px ${c.fg}`,
        color: c.fg,
        fontFamily: "var(--wds-font-sans)",
        fontSize: s.font,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: "nowrap",
        letterSpacing: "0.01em",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ---------------- ProgressBar ---------------- */

export function ProgressBar({
  value = 0,
  height = 6,
  tone = "primary",
  style,
}: {
  value?: number;
  height?: number;
  tone?: "primary" | "positive";
  style?: CSSProperties;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const fill = tone === "positive" ? "var(--wds-status-positive)" : "var(--wds-primary)";
  return (
    <div
      style={{
        width: "100%",
        height,
        borderRadius: 999,
        background: "var(--wds-fill-strong)",
        overflow: "hidden",
        ...style,
      }}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 999,
          background: fill,
          transition: "width .3s ease",
        }}
      />
    </div>
  );
}

/* ---------------- Chip ---------------- */

type ChipSize = "small" | "normal" | "large";

const CHIP_SIZES: Record<ChipSize, { height: number; padX: number; font: number; radius: number }> = {
  small: { height: 32, padX: 12, font: 13, radius: 999 },
  normal: { height: 36, padX: 14, font: 14, radius: 999 },
  large: { height: 40, padX: 16, font: 15, radius: 999 },
};

export function Chip({
  children,
  active = false,
  disabled = false,
  size = "normal",
  onClick,
  style,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  size?: ChipSize;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  const s = CHIP_SIZES[size];
  const [hover, setHover] = useState(false);
  let bg: string, fg: string, ring: string;
  if (disabled) {
    bg = "var(--wds-fill-alternative)";
    fg = "var(--wds-label-disable)";
    ring = "transparent";
  } else if (active) {
    bg = "var(--wds-primary-bg)";
    fg = "var(--wds-primary-strong)";
    ring = "rgba(0,102,255,0.24)";
  } else {
    bg = hover ? "var(--wds-fill-normal)" : "var(--wds-bg)";
    fg = "var(--wds-label-neutral)";
    ring = "var(--wds-line-normal)";
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        height: s.height,
        padding: `0 ${s.padX}px`,
        boxSizing: "border-box",
        borderRadius: s.radius,
        border: "none",
        outline: "none",
        backgroundColor: bg,
        color: fg,
        boxShadow: `inset 0 0 0 1px ${ring}`,
        fontFamily: "var(--wds-font-sans)",
        fontSize: s.font,
        fontWeight: active ? 600 : 500,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
        cursor: disabled ? "default" : "pointer",
        transition: "background-color .15s ease, color .15s ease, box-shadow .15s ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* ---------------- TextField ---------------- */

type FieldStatus = "normal" | "negative" | "positive";

const FIELD_STATUS: Record<FieldStatus, { border: string; focus: string; msg: string }> = {
  normal: {
    border: "var(--wds-line-normal)",
    focus: "var(--wds-primary)",
    msg: "var(--wds-label-alternative)",
  },
  negative: {
    border: "var(--wds-status-negative)",
    focus: "var(--wds-status-negative)",
    msg: "var(--wds-status-negative)",
  },
  positive: {
    border: "var(--wds-status-positive)",
    focus: "var(--wds-status-positive)",
    msg: "var(--wds-status-positive)",
  },
};

export function TextField({
  label,
  value,
  placeholder,
  status = "normal",
  disabled = false,
  message,
  name,
  required,
  onChange,
  onKeyDown,
  type = "text",
  style,
}: {
  label?: ReactNode;
  value?: string;
  placeholder?: string;
  status?: FieldStatus;
  disabled?: boolean;
  message?: ReactNode;
  name?: string;
  required?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  type?: string;
  style?: CSSProperties;
}) {
  const [focus, setFocus] = useState(false);
  const st = FIELD_STATUS[status];
  const borderColor = disabled
    ? "var(--wds-line-neutral)"
    : focus
      ? st.focus
      : st.border;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", ...style }}>
      {label != null && (
        <span
          style={{
            fontFamily: "var(--wds-font-sans)",
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.43,
            color: "var(--wds-label-neutral)",
          }}
        >
          {label}
        </span>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 48,
          padding: "0 16px",
          boxSizing: "border-box",
          borderRadius: 10,
          backgroundColor: disabled ? "var(--wds-fill-alternative)" : "var(--wds-bg)",
          boxShadow: `inset 0 0 0 ${focus ? 1.5 : 1}px ${borderColor}`,
          transition: "box-shadow .15s ease",
        }}
      >
        <input
          type={type}
          name={name}
          required={required}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            fontFamily: "var(--wds-font-sans)",
            fontSize: 16,
            lineHeight: 1.5,
            letterSpacing: "0.0057em",
            color: "var(--wds-label-normal)",
          }}
        />
      </div>
      {message != null && (
        <span
          style={{
            fontFamily: "var(--wds-font-sans)",
            fontSize: 13,
            lineHeight: 1.385,
            color: st.msg,
          }}
        >
          {message}
        </span>
      )}
    </div>
  );
}

/* ---------------- SelectBox ---------------- */

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectBox({
  label,
  value,
  placeholder = "선택",
  options = [],
  onChange,
  disabled = false,
  style,
}: {
  label?: ReactNode;
  value?: string;
  placeholder?: string;
  options?: SelectOption[];
  onChange?: (value: string) => void;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
        position: "relative",
        ...style,
      }}
    >
      {label != null && (
        <span
          style={{
            fontFamily: "var(--wds-font-sans)",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--wds-label-neutral)",
          }}
        >
          {label}
        </span>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          height: 48,
          padding: "0 16px",
          borderRadius: 10,
          border: "none",
          background: disabled ? "var(--wds-fill-alternative)" : "var(--wds-bg)",
          boxShadow: `inset 0 0 0 ${open ? 1.5 : 1}px ${
            open ? "var(--wds-primary)" : "var(--wds-line-normal)"
          }`,
          cursor: disabled ? "default" : "pointer",
          fontFamily: "var(--wds-font-sans)",
          fontSize: 16,
          color: selected ? "var(--wds-label-normal)" : "var(--wds-label-assistive)",
        }}
      >
        {selected ? selected.label : placeholder}
        <span
          style={{
            color: "var(--wds-label-alternative)",
            display: "inline-flex",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform .15s ease",
          }}
        >
          <Icon name="chevron-down" size={20} />
        </span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 6,
            zIndex: 20,
            background: "var(--wds-bg-elevated)",
            borderRadius: 12,
            boxShadow: "var(--wds-shadow-strong)",
            padding: 6,
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange?.(o.value);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                border: "none",
                background: "transparent",
                borderRadius: 8,
                padding: "11px 12px",
                cursor: "pointer",
                fontFamily: "var(--wds-font-sans)",
                fontSize: 15,
                color: "var(--wds-label-normal)",
                fontWeight: o.value === value ? 600 : 400,
              }}
            >
              {o.label}
              {o.value === value && (
                <span style={{ color: "var(--wds-primary)", display: "inline-flex" }}>
                  <Icon name="check-bold" size={18} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- SegmentedControl ---------------- */

export function SegmentedControl({
  items = [],
  value,
  onChange,
  size = "medium",
  style,
}: {
  items?: { key: string; label: string }[];
  value?: string;
  onChange?: (key: string) => void;
  size?: "small" | "medium";
  style?: CSSProperties;
}) {
  const h = size === "small" ? 32 : 40;
  const idx = Math.max(
    0,
    items.findIndex((it) => it.key === value),
  );
  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        width: "100%",
        padding: 3,
        height: h,
        boxSizing: "border-box",
        borderRadius: 10,
        background: "var(--wds-fill-normal)",
        ...style,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          bottom: 3,
          left: `calc(${idx} * (100% - 6px) / ${items.length} + 3px)`,
          width: `calc((100% - 6px) / ${items.length})`,
          borderRadius: 8,
          background: "var(--wds-bg)",
          boxShadow: "var(--wds-shadow-card)",
          transition: "left .2s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
      {items.map((it) => {
        const on = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange?.(it.key)}
            style={{
              position: "relative",
              flex: 1,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "var(--wds-font-sans)",
              fontSize: size === "small" ? 13 : 14,
              fontWeight: 600,
              color: on ? "var(--wds-label-normal)" : "var(--wds-label-alternative)",
              transition: "color .15s ease",
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Switch ---------------- */

const SWITCH_SIZES = {
  small: { w: 36, h: 22, knob: 18 },
  normal: { w: 52, h: 32, knob: 26 },
} as const;

export function Switch({
  checked = false,
  disabled = false,
  size = "normal",
  onChange,
  style,
}: {
  checked?: boolean;
  disabled?: boolean;
  size?: keyof typeof SWITCH_SIZES;
  onChange?: (next: boolean) => void;
  style?: CSSProperties;
}) {
  const s = SWITCH_SIZES[size];
  const pad = (s.h - s.knob) / 2;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      style={{
        position: "relative",
        width: s.w,
        height: s.h,
        padding: 0,
        border: "none",
        borderRadius: 999,
        boxSizing: "border-box",
        flexShrink: 0,
        cursor: disabled ? "default" : "pointer",
        backgroundColor: checked
          ? disabled
            ? "var(--wds-label-disable)"
            : "var(--wds-primary)"
          : disabled
            ? "var(--wds-interaction-disable)"
            : "var(--wds-fill-strong)",
        transition: "background-color .2s ease",
        ...style,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: pad,
          left: checked ? s.w - s.knob - pad : pad,
          width: s.knob,
          height: s.knob,
          borderRadius: 999,
          backgroundColor: "var(--wds-static-white)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.16)",
          transition: "left .2s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
    </button>
  );
}

/* ---------------- Callout ---------------- */

const CALLOUT_TONES = {
  neutral: { bg: "var(--wds-fill-normal)", fg: "var(--wds-label-neutral)" },
  primary: { bg: "var(--wds-primary-bg)", fg: "var(--wds-primary-strong)" },
  positive: { bg: "var(--wds-status-positive-bg)", fg: "var(--wds-status-positive)" },
  negative: { bg: "var(--wds-status-negative-bg)", fg: "var(--wds-status-negative)" },
} as const;

export function Callout({
  children,
  title,
  icon = "circle-info",
  tone = "neutral",
  style,
}: {
  children: ReactNode;
  title?: ReactNode;
  icon?: WdsIconName;
  tone?: keyof typeof CALLOUT_TONES;
  style?: CSSProperties;
}) {
  const c = CALLOUT_TONES[tone];
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "14px 16px",
        borderRadius: 12,
        background: c.bg,
        boxSizing: "border-box",
        fontFamily: "var(--wds-font-sans)",
        ...style,
      }}
    >
      <span style={{ color: c.fg, display: "inline-flex", flexShrink: 0, paddingTop: 1 }}>
        <Icon name={icon} size={20} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title != null && (
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--wds-label-normal)",
              marginBottom: 2,
            }}
          >
            {title}
          </div>
        )}
        <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--wds-label-neutral)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
