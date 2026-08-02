"use client";

import { useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";

/**
 * WDS Button — 원본 components/action/Button/Button.jsx 이식.
 * 크기·색·상태값은 번들 소스 그대로다. 값을 바꾸면 원본과 어긋난다.
 */
type Variant = "solid" | "outlined" | "text";
type Color = "primary" | "assistive" | "negative";
type Size = "xsmall" | "small" | "medium" | "large";

const SIZES: Record<Size, { height: number; radius: number; padX: number; gap: number; font: number; line: number; ls: string; weight: number }> = {
  xsmall: { height: 24, radius: 6, padX: 7, gap: 2, font: 12, line: 1.334, ls: "0.025em", weight: 500 },
  small: { height: 32, radius: 8, padX: 10, gap: 2, font: 13, line: 1.385, ls: "0.019em", weight: 500 },
  medium: { height: 36, radius: 8, padX: 12, gap: 3, font: 14, line: 1.43, ls: "0.0145em", weight: 600 },
  large: { height: 40, radius: 10, padX: 12, gap: 3, font: 15, line: 1.467, ls: "0.010em", weight: 600 },
};

const PALETTE: Record<Color, { solidBg: string; solidBgHover: string; solidBgPress: string; on: string; fg: string }> = {
  primary: {
    solidBg: "var(--wds-primary)",
    solidBgHover: "var(--wds-primary-strong)",
    solidBgPress: "var(--wds-primary-heavy)",
    on: "var(--wds-static-white)",
    fg: "var(--wds-primary)",
  },
  assistive: {
    solidBg: "rgb(244,244,245)",
    solidBgHover: "rgb(234,235,236)",
    solidBgPress: "rgb(225,226,228)",
    on: "var(--wds-label-normal)",
    fg: "var(--wds-label-neutral)",
  },
  negative: {
    solidBg: "var(--wds-status-negative)",
    solidBgHover: "rgb(230,50,50)",
    solidBgPress: "rgb(205,40,40)",
    on: "var(--wds-static-white)",
    fg: "var(--wds-status-negative)",
  },
};

export interface WdsButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  variant?: Variant;
  color?: Color;
  size?: Size;
  round?: boolean;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  children?: ReactNode;
}

export function Button({
  children,
  variant = "solid",
  color = "primary",
  size = "medium",
  round = false,
  disabled = false,
  fullWidth = false,
  leadingIcon = null,
  trailingIcon = null,
  style,
  ...rest
}: WdsButtonProps) {
  const s = SIZES[size];
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const palette = PALETTE[color];

  const base: CSSProperties = {
    display: "inline-flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: s.gap,
    height: s.height,
    padding: `0 ${s.padX}px`,
    boxSizing: "border-box",
    width: fullWidth ? "100%" : "auto",
    borderRadius: round ? 999 : s.radius,
    border: "none",
    outline: "none",
    cursor: disabled ? "default" : "pointer",
    fontFamily: "var(--wds-font-sans)",
    fontWeight: s.weight,
    fontSize: s.font,
    lineHeight: s.line,
    letterSpacing: s.ls,
    whiteSpace: "nowrap",
    transition:
      "background-color .15s ease, color .15s ease, box-shadow .15s ease, transform .05s ease",
    transform: press && !disabled ? "scale(0.98)" : "none",
    userSelect: "none",
  };

  let vs: CSSProperties;
  if (variant === "solid") {
    vs = {
      backgroundColor: disabled
        ? "var(--wds-interaction-disable)"
        : press
          ? palette.solidBgPress
          : hover
            ? palette.solidBgHover
            : palette.solidBg,
      color: disabled ? "var(--wds-label-disable)" : palette.on,
    };
  } else if (variant === "outlined") {
    vs = {
      backgroundColor: disabled
        ? "transparent"
        : press
          ? "var(--wds-fill-strong)"
          : hover
            ? "var(--wds-fill-normal)"
            : "transparent",
      boxShadow: `inset 0 0 0 1px ${
        disabled
          ? "var(--wds-line-neutral)"
          : color === "primary"
            ? "rgba(0,102,255,0.5)"
            : "var(--wds-line-normal)"
      }`,
      color: disabled ? "var(--wds-label-disable)" : palette.fg,
    };
  } else {
    vs = {
      backgroundColor: disabled
        ? "transparent"
        : press
          ? "var(--wds-fill-strong)"
          : hover
            ? "var(--wds-fill-normal)"
            : "transparent",
      color: disabled ? "var(--wds-label-disable)" : palette.fg,
    };
  }

  return (
    <button
      type="button"
      disabled={disabled}
      style={{ ...base, ...vs, ...style }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPress(false);
      }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}
