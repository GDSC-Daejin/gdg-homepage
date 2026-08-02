import { cn } from "@/lib/cn";

type Tone = "neutral" | "warning" | "primary" | "success" | "danger";

const toneClasses: Record<Tone, string> = {
  neutral: "text-gray-900",
  warning: "text-warning",
  primary: "text-primary",
  success: "text-success",
  danger: "text-danger",
};

export function StatCard({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: Tone;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-white dark:bg-gray-100 p-4 text-left shadow-card transition-colors",
        active
          ? "border-primary ring-1 ring-primary"
          : "border-gray-200 hover:border-gray-300",
      )}
    >
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold", toneClasses[tone])}>{value}</p>
    </button>
  );
}
