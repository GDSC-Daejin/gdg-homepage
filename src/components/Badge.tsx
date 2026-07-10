import { ReactNode } from "react";
import { cn } from "@/lib/cn";

type BadgeTone = "primary" | "success" | "warning" | "danger" | "neutral";

interface BadgeProps {
  tone: BadgeTone;
  solid?: boolean;
  children: ReactNode;
  className?: string;
}

const toneClasses: Record<BadgeTone, string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-gray-100 text-gray-700",
};

const solidToneClasses: Record<BadgeTone, string> = {
  primary: "bg-primary text-white",
  success: "bg-success text-white",
  warning: "bg-warning text-white",
  danger: "bg-danger text-white",
  neutral: "bg-gray-600 text-white",
};

export function Badge({ tone, solid, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        solid ? solidToneClasses[tone] : toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
