import { SelectHTMLAttributes, useId } from "react";
import { cn } from "@/lib/cn";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({
  label,
  error,
  id,
  className,
  children,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          "h-10 w-full rounded-md border bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:text-gray-400",
          error
            ? "border-danger focus:border-danger focus:ring-danger"
            : "border-gray-300 focus:border-primary focus:ring-primary",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
