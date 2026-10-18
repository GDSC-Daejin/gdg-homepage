"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { joinSupplies, splitSupplies } from "@/lib/notice-body";

interface SuppliesInputProps {
  name: string;
  label: ReactNode;
  defaultValue?: string;
  suggestions?: string[];
}

export function SuppliesInput({
  name,
  label,
  defaultValue = "",
  suggestions = [],
}: SuppliesInputProps) {
  const inputId = useId();
  const hintId = useId();
  const [items, setItems] = useState(() => splitSupplies(defaultValue));
  const [draft, setDraft] = useState("");

  function add(text: string) {
    const next = splitSupplies(text).filter((item) => !items.includes(item));
    if (next.length) setItems([...items, ...next]);
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // 한글 조합 중 Enter는 글자 확정용이라 칩으로 만들지 않는다
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && items.length) {
      setItems(items.slice(0, -1));
    }
  }

  const remaining = suggestions.filter((item) => !items.includes(item));

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      {/* 입력 중인 글자도 제출 때 빠지지 않게 같이 담는다 */}
      <input type="hidden" name={name} value={joinSupplies(splitSupplies([...items, draft].join(",")))} />
      <div className="flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2 py-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary dark:bg-gray-100">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex h-7 items-center gap-0.5 rounded-full bg-primary-soft pl-2.5 pr-0.5 text-sm text-gray-800"
          >
            {item}
            <button
              type="button"
              onClick={() => setItems(items.filter((x) => x !== item))}
              aria-label={`${item} 빼기`}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-primary hover:bg-primary-soft-hover"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-3 w-3" aria-hidden="true">
                <path d="M6 6l8 8M14 6l-8 8" />
              </svg>
            </button>
          </span>
        ))}
        <input
          id={inputId}
          value={draft}
          onChange={(e) => {
            const value = e.target.value;
            if (value.endsWith(",")) add(value);
            else setDraft(value);
          }}
          onKeyDown={handleKeyDown}
          aria-describedby={hintId}
          placeholder={items.length ? "더 추가하기" : "예) 노트북, 충전기"}
          className="h-7 min-w-28 flex-1 bg-transparent px-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
        />
      </div>
      {remaining.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-xs text-gray-400">자주 쓰는 준비물</span>
          {remaining.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => add(item)}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-gray-300 px-2.5 text-xs text-gray-600 hover:border-primary hover:text-primary"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="h-3 w-3" aria-hidden="true">
                <path d="M10 4v12M4 10h12" />
              </svg>
              {item}
            </button>
          ))}
        </div>
      )}
      <p id={hintId} className="text-xs text-gray-400">
        Enter나 쉼표로 추가하고, 비어 있을 때 Backspace로 마지막 항목을 지워요.
      </p>
    </div>
  );
}
