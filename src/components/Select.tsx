"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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

function optionText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(optionText).join("");
  if (isValidElement(node)) return optionText((node.props as { children?: ReactNode }).children);
  return "";
}

function createsContainingBlock(el: HTMLElement): boolean {
  const s = getComputedStyle(el);
  return (
    s.transform !== "none" ||
    s.translate !== "none" ||
    s.scale !== "none" ||
    s.rotate !== "none"
  );
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
  const errorId = useId();
  const listboxId = useId();
  const labelId = `${selectId}-label`;
  const options = readOptions(children);
  const menuOptions = options.filter((o) => !(o.value === "" && o.disabled));

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = isControlled ? value : internal;

  const { ref, open, setOpen } = useDismiss<HTMLDivElement>();
  const hiddenRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // overflow 컨테이너(모달 스크롤 영역 등) 안에서 드롭다운을 아래로 펼치면
  // 그 컨테이너의 스크롤 영역이 늘어나 스크롤바가 생기고 레이아웃이 흔들린다.
  // → 클릭 시 위치를 재서 fixed 로 컨테이너를 탈출시키고, top-layer <dialog> 가
  //   있으면 그 안으로 portal 해 모달 위에 그려지게 한다(모달 밖으로 넘쳐도 OK).
  const [portal, setPortal] = useState<{
    target: HTMLElement;
    style: CSSProperties;
  } | null>(null);

  function openMenu() {
    const trigger = ref.current;
    if (!trigger) {
      setOpen(true);
      return;
    }
    let dialog: HTMLElement | null = null;
    let clipped = false;
    for (let n = trigger.parentElement; n; n = n.parentElement) {
      if (n.tagName === "DIALOG") {
        dialog = n;
        break;
      }
      const oy = getComputedStyle(n).overflowY;
      if (oy === "auto" || oy === "scroll" || oy === "hidden") clipped = true;
    }
    if (dialog || clipped) {
      const r = trigger.getBoundingClientRect();
      let top = r.bottom + 4;
      let left = r.left;
      // transform/translate/scale/rotate 된 dialog 는 fixed 자식의 containing block 이
      // 되므로 dialog 기준으로 보정. (Tailwind v4 는 translate/scale 을 개별 CSS 속성으로
      // 컴파일해 getComputedStyle().transform 엔 안 잡히지만 containing block 은 만든다.)
      if (dialog && createsContainingBlock(dialog)) {
        const d = dialog.getBoundingClientRect();
        top = r.bottom - d.top + 4;
        left = r.left - d.left;
      }
      setPortal({
        target: dialog ?? document.body,
        style: { position: "fixed", top, left, width: r.width },
      });
    } else {
      setPortal(null);
    }
    setOpen(true);
  }

  // 스크롤/리사이즈 시 portal 위치가 어긋나므로 닫는다.
  useEffect(() => {
    if (!open || !portal) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, portal, setOpen]);

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
    setActiveIndex(null);
  }

  const optionId = (index: number) => `${listboxId}-option-${index}`;
  const initialActiveIndex = () => {
    const selectedIndex = menuOptions.findIndex((o) => o.value === current && !o.disabled);
    return selectedIndex >= 0 ? selectedIndex : menuOptions.findIndex((o) => !o.disabled);
  };

  function openWithActiveOption() {
    setActiveIndex(initialActiveIndex());
    openMenu();
  }

  function closeMenu() {
    setOpen(false);
    setActiveIndex(null);
  }

  function moveActive(delta: number) {
    const enabled = menuOptions.flatMap((option, index) => (option.disabled ? [] : [index]));
    if (!enabled.length) return;
    setActiveIndex((index) => {
      const currentIndex = index ?? initialActiveIndex();
      const position = enabled.indexOf(currentIndex);
      return enabled[(position + delta + enabled.length) % enabled.length];
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const isSelectKey = event.key === "Enter" || event.key === " " || event.key === "Spacebar";
    if (!open) {
      if (isSelectKey || event.key === "ArrowDown") {
        event.preventDefault();
        openWithActiveOption();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const enabled = menuOptions.flatMap((option, index) => (option.disabled ? [] : [index]));
      setActiveIndex(enabled[event.key === "Home" ? 0 : enabled.length - 1] ?? null);
    } else if (isSelectKey) {
      event.preventDefault();
      const index = activeIndex ?? initialActiveIndex();
      if (index >= 0) select(menuOptions[index].value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
    } else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const index = menuOptions.findIndex(
        (option) => !option.disabled && optionText(option.label).toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()),
      );
      if (index >= 0) select(menuOptions[index].value);
    }
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
        <label id={labelId} htmlFor={selectId} className="text-sm font-medium text-gray-700">
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
          onClick={() => (open ? closeMenu() : openWithActiveOption())}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && activeIndex !== null ? optionId(activeIndex) : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
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
        {open &&
          (() => {
            const items = menuOptions.map((opt, index) => {
                const selected = opt.value === current;
                const active = activeIndex === index;
                return (
                  <li
                    key={opt.value}
                    id={optionId(index)}
                    role="option"
                    aria-selected={selected}
                    aria-disabled={opt.disabled}
                    onClick={() => !opt.disabled && select(opt.value)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-2 rounded px-3 py-2 text-sm",
                      opt.disabled
                        ? "cursor-not-allowed text-gray-300"
                        : active || selected
                          ? "bg-primary-soft text-primary"
                          : "text-gray-700 hover:bg-gray-100",
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {selected && (
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
              });

            // portal: 스크롤 컨테이너를 탈출한 fixed 메뉴 (모달 등)
            if (portal) {
              return createPortal(
                <ul
                  role="listbox"
                  id={listboxId}
                  aria-labelledby={label ? labelId : undefined}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={portal.style}
                  className="select-menu z-50 max-h-60 min-w-max overflow-auto rounded-md border border-gray-200 bg-white dark:bg-gray-100 p-1 shadow-card"
                >
                  {items}
                </ul>,
                portal.target,
              );
            }
            // 일반: 인라인 absolute 메뉴
            return (
              <ul
                role="listbox"
                id={listboxId}
                aria-labelledby={label ? labelId : undefined}
                className="select-menu absolute top-full z-50 mt-1 max-h-60 w-full min-w-max overflow-auto rounded-md border border-gray-200 bg-white dark:bg-gray-100 p-1 shadow-card"
              >
                {items}
              </ul>
            );
          })()}
      </div>
      {error && <p id={errorId} role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
