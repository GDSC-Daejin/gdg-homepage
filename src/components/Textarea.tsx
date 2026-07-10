import { TextareaHTMLAttributes, ReactNode, useId } from "react";
import { cn } from "@/lib/cn";

interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "label"> {
  label?: ReactNode;
  error?: string;
}

export function Textarea({
  label,
  error,
  id,
  className,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={textareaId}
          className="text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={cn(
          "w-full resize-none rounded-md border bg-white dark:bg-gray-100 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:text-gray-400",
          error
            ? "border-danger focus:border-danger focus:ring-danger"
            : "border-gray-300 focus:border-primary focus:ring-primary",
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
