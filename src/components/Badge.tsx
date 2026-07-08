import { ReactNode } from "react";
import { cn } from "@/lib/cn";

type BadgeTone = "primary" | "success" | "warning" | "danger" | "neutral";

interface BadgeProps {
  tone: BadgeTone;
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

export function Badge({ tone, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
