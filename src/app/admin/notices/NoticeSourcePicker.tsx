"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/** 불러오기 카드 한 장. 서버에서 만들어 넘기므로 직렬화 가능한 값만 담는다. */
export interface NoticeSource {
  id: string;
  kind: "recent" | "template";
  /** 카드 제목: 최근 공지는 공지 제목, 템플릿은 템플릿 이름 */
  label: string;
  meta: string;
  summary: string;
  title: string;
  body: string;
}

interface NoticeSourcePickerProps {
  sources: NoticeSource[];
  pickedId?: string;
  onPick: (source: NoticeSource) => void;
}

const TABS = [
  { kind: "recent", label: "최근 공지", empty: "아직 작성한 공지가 없어요." },
  { kind: "template", label: "템플릿", empty: "저장한 템플릿이 없어요. 아래 폼에서 ‘템플릿으로 저장’을 눌러 만들어요." },
] as const;

export function NoticeSourcePicker({ sources, pickedId, onPick }: NoticeSourcePickerProps) {
  const [kind, setKind] = useState<NoticeSource["kind"]>("recent");
  const tab = TABS.find((t) => t.kind === kind) ?? TABS[0];
  const visible = sources.filter((s) => s.kind === kind);

  return (
    <section
      aria-labelledby="notice-source-title"
      className="mb-6 flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="notice-source-title" className="text-sm font-semibold text-gray-900">
            불러와서 시작하기
          </h2>
          <p className="text-xs text-gray-500">
            제목·장소·준비물·본문을 채워 드려요. 일정은 비워 두니 새로 골라 주세요.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 dark:bg-gray-100">
          {TABS.map((t) => {
            const count = sources.filter((s) => s.kind === t.kind).length;
            return (
              <button
                key={t.kind}
                type="button"
                aria-pressed={kind === t.kind}
                onClick={() => setKind(t.kind)}
                className={cn(
                  "h-8 rounded-md px-3 text-xs font-semibold",
                  kind === t.kind ? "bg-gray-200 text-gray-900" : "text-gray-500 hover:text-gray-900",
                )}
              >
                {t.label} {t.kind === "template" && <span className="font-medium text-gray-400">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-xs text-gray-500">
          {tab.empty}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {visible.map((source) => {
            const selected = source.id === pickedId;
            return (
              <li key={source.id} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onPick(source)}
                  className={cn(
                    "flex w-full min-w-0 flex-col items-start gap-1 rounded-lg border px-3.5 py-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary-soft"
                      : "border-gray-200 bg-white hover:border-gray-300 dark:bg-gray-100",
                  )}
                >
                  <span className="text-[11px] text-gray-500">{source.meta}</span>
                  <span className="w-full truncate text-sm font-semibold text-gray-900">{source.label}</span>
                  <span className="w-full truncate text-xs text-gray-500">{source.summary}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
