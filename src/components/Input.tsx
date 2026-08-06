import { InputHTMLAttributes, ReactNode, useId } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "label"> {
  label?: ReactNode;
  error?: string;
}

export function Input({ label, error, id, className, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = useId();

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label} {props.required && <span aria-hidden="true" className="text-danger">*</span>}
        </label>
      )}
      <input
        {...props}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "h-10 w-full rounded-md border bg-white dark:bg-gray-100 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:text-gray-400",
          error
            ? "border-danger focus:border-danger focus:ring-danger"
            : "border-gray-300 focus:border-primary focus:ring-primary",
          className,
        )}
      />
      {error && <p id={errorId} role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
