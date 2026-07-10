"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { useDismiss } from "@/lib/useDismiss";

export type SelectChangeEvent = { target: { value: string } };

interface SelectProps {
  label?: ReactNode;
  error?: string;
  id?: string;
  name?: string;
  className?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: SelectChangeEvent) => void;
  required?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}

interface Opt {
  value: string;
  label: ReactNode;
  disabled: boolean;
}

function readOptions(children: ReactNode): Opt[] {
  const opts: Opt[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as {
      value?: string | number;
      disabled?: boolean;
      children?: ReactNode;
    };
    opts.push({
      value: String(props.value ?? ""),
      label: props.children,
      disabled: Boolean(props.disabled),
    });
  });
  return opts;
}

export function Select({
  label,
  error,
  id,
  name,
  className,
  value,
  defaultValue,
  onChange,
  required,
  disabled,
  children,
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const options = readOptions(children);

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = isControlled ? value : internal;

  const { ref, open, setOpen } = useDismiss<HTMLDivElement>();
  const hiddenRef = useRef<HTMLInputElement>(null);

  // 네이티브 form.reset() 에 반응 (uncontrolled)
  useEffect(() => {
    if (isControlled) return;
    const form = hiddenRef.current?.form;
    if (!form) return;
    const onReset = () => setInternal(defaultValue ?? "");
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [isControlled, defaultValue]);

  function select(v: string) {
    if (!isControlled) setInternal(v);
    onChange?.({ target: { value: v } });
    setOpen(false);
  }

  const selected = options.find((o) => o.value === current);
  const placeholder = options.find((o) => o.value === "" && o.disabled);
  const displayLabel =
    selected && selected.value !== ""
      ? selected.label
      : placeholder?.label ?? selected?.label;
  const isPlaceholder = !selected || (selected.value === "" && selected.disabled);

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div ref={ref} className="relative">
        {name && (
          <input
            ref={hiddenRef}
            type="hidden"
            name={name}
            value={current}
            required={required}
          />
        )}
        <button
          id={selectId}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-white dark:bg-gray-100 px-3 text-left text-sm focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:text-gray-400",
            isPlaceholder ? "text-gray-400" : "text-gray-900",
            error
              ? "border-danger focus:border-danger focus:ring-danger"
              : "border-gray-300 focus:border-primary focus:ring-primary",
            className,
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <svg
            className={cn(
              "h-4 w-4 shrink-0 text-gray-400 transition-transform",
              open && "rotate-180",
            )}
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open && (
          <ul
            role="listbox"
            className="absolute z-50 mt-1 max-h-60 w-full min-w-max overflow-auto rounded-md border border-gray-200 bg-white dark:bg-gray-100 p-1 shadow-card"
          >
            {options
              .filter((o) => !(o.value === "" && o.disabled))
              .map((opt) => {
                const active = opt.value === current;
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={active}
                    aria-disabled={opt.disabled}
                    onClick={() => !opt.disabled && select(opt.value)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-2 rounded px-3 py-2 text-sm",
                      opt.disabled
                        ? "cursor-not-allowed text-gray-300"
                        : active
                          ? "bg-primary-soft text-primary"
                          : "text-gray-700 hover:bg-gray-100",
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {active && (
                      <svg
                        className="h-4 w-4 shrink-0"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          d="M5 10l3 3 7-7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
