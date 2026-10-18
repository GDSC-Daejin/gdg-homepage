"use client";

import { cn } from "@/lib/cn";

/** 불러오기 칩 하나. 서버에서 만들어 넘기므로 직렬화 가능한 값만 담는다. */
export interface NoticeSource {
  id: string;
  kind: "recent" | "template";
  /** 칩 이름: 최근 공지는 공지 제목, 템플릿은 템플릿 이름 */
  label: string;
  /** 칩에 마우스를 올리면 보이는 설명 (날짜·장소 등) */
  meta: string;
  title: string;
  body: string;
}

interface NoticeSourcePickerProps {
  sources: NoticeSource[];
  pickedId?: string;
  onPick: (source: NoticeSource) => void;
}

function SourceChip({
  source,
  selected,
  onPick,
}: {
  source: NoticeSource;
  selected: boolean;
  onPick: (source: NoticeSource) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      title={source.meta}
      onClick={() => onPick(source)}
      className={cn(
        "inline-flex h-8 max-w-56 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors",
        selected
          ? "border-primary bg-primary-soft text-gray-900"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:bg-gray-100",
      )}
    >
      {source.kind === "recent" ? (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
          <circle cx="10" cy="10" r="7" />
          <path d="M10 6.5V10l2.5 1.5" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
          <rect x="4" y="3" width="12" height="14" rx="2" />
          <path d="M7.5 7h5M7.5 10h5M7.5 13h3" />
        </svg>
      )}
      <span className="truncate">{source.label}</span>
    </button>
  );
}

/** 폼 맨 위 한 줄: 최근 공지·템플릿을 골라 내용을 채운다. */
export function NoticeSourcePicker({ sources, pickedId, onPick }: NoticeSourcePickerProps) {
  const recent = sources.filter((s) => s.kind === "recent");
  const templates = sources.filter((s) => s.kind === "template");

  return (
    <div
      role="group"
      aria-labelledby="notice-source-title"
      className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 pb-4"
    >
      <span id="notice-source-title" className="mr-1 text-xs font-semibold text-gray-700">
        빠르게 시작
      </span>
      {recent.map((source) => (
        <SourceChip key={source.id} source={source} selected={source.id === pickedId} onPick={onPick} />
      ))}
      {recent.length > 0 && <span aria-hidden="true" className="mx-1 h-4 w-px bg-gray-200" />}
      {templates.length > 0 ? (
        templates.map((source) => (
          <SourceChip key={source.id} source={source} selected={source.id === pickedId} onPick={onPick} />
        ))
      ) : (
        <span className="text-xs text-gray-400">템플릿은 아래 ‘템플릿으로 저장’으로 만들어요</span>
      )}
    </div>
  );
}
