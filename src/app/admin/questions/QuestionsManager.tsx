"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import {
  applyApplicationQuestionPreset,
  createApplicationQuestion,
  deleteApplicationQuestion,
  reorderApplicationQuestions,
  saveApplicationQuestionPreset,
  updateApplicationQuestion,
} from "@/actions/application-question";
import { createInterviewQuestion, deleteInterviewQuestion, updateInterviewQuestion } from "@/actions/interview-question";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { cn } from "@/lib/cn";
import {
  POSITION_LABELS,
  type ActionResult,
  type ApplicationQuestion,
  type ApplicationQuestionPreset,
  type InterviewQuestion,
  type Position,
} from "@/lib/types";
import {
  POSITIONS,
  applicationQuestionsOf,
  interviewQuestionsOf,
  interviewerViewOrder,
  reorderPosition,
  saveWithRollback,
  seasonLabel,
  type PositionKey,
  type SaveState,
  type QuestionKind,
} from "./question-model";

const KIND_LABELS: Record<QuestionKind, string> = { application: "지원서 질문", interview: "면접 질문" };

function keyLabel(key: PositionKey) {
  return key === "common" ? "공통" : POSITION_LABELS[key];
}

export function QuestionsManager({
  applicationQuestions,
  interviewQuestions,
  presets,
  season,
  openPositions,
  demo,
}: {
  applicationQuestions: ApplicationQuestion[];
  interviewQuestions: InterviewQuestion[];
  presets: ApplicationQuestionPreset[];
  season: string;
  openPositions: Position[];
  demo: boolean;
}) {
  const [kind, setKind] = useState<QuestionKind>("application");
  const [selected, setSelected] = useState<PositionKey>("frontend");
  const [previewOpen, setPreviewOpen] = useState(true);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const [announcement, setAnnouncement] = useState("");
  const [, startTransition] = useTransition();
  const localId = useRef(0);
  const focusHandle = useRef<string | null>(null);

  // 서버가 새 목록을 내려주면(저장 후 revalidate) 화면 사본을 맞춘다. 둘러보기에선 props가 그대로라 사본만 바뀐다.
  const [appSource, setAppSource] = useState(applicationQuestions);
  const [appItems, setAppItems] = useState(applicationQuestions);
  if (appSource !== applicationQuestions) {
    setAppSource(applicationQuestions);
    setAppItems(applicationQuestions);
  }
  const [ivSource, setIvSource] = useState(interviewQuestions);
  const [ivItems, setIvItems] = useState(interviewQuestions);
  if (ivSource !== interviewQuestions) {
    setIvSource(interviewQuestions);
    setIvItems(interviewQuestions);
  }

  useEffect(() => {
    if (!focusHandle.current) return;
    document.querySelector<HTMLElement>(`[data-move-handle="${focusHandle.current}"]`)?.focus();
    focusHandle.current = null;
  });

  const saving = save.status === "saving";
  const position: Position = selected === "common" ? "frontend" : selected;

  /** 화면을 먼저 바꾸고 저장한다. 실패하면 바꾸기 전 목록으로 되돌리고 이유를 보여준다. */
  function persist(run: () => Promise<ActionResult | undefined>, apply: () => void, done?: string) {
    const prevApp = appItems;
    const prevIv = ivItems;
    apply();
    if (done) setAnnouncement(done);
    if (demo) return setSave({ status: "demo" });
    setSave({ status: "saving" });
    startTransition(async () => {
      const next = await saveWithRollback(run, () => {
        setAppItems(prevApp);
        setIvItems(prevIv);
      });
      setSave(next);
    });
  }

  function nextLocalId() {
    localId.current += 1;
    return `local-${localId.current}`;
  }

  function switchKind(next: QuestionKind) {
    setKind(next);
    if (next === "application" && selected === "common") setSelected("frontend");
    if (next === "interview") setTemplateOpen(false);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = kind === "application" ? "interview" : "application";
    switchKind(next);
    document.getElementById(`question-tab-${next}`)?.focus();
  }

  // ── 지원서 질문
  const appList = applicationQuestionsOf(appItems, position);

  function moveApplication(from: number, to: number) {
    if (to < 0 || to >= appList.length || saving) return;
    const next = reorderPosition(appItems, position, from, to);
    const ids = applicationQuestionsOf(next, position).map((question) => question.id);
    focusHandle.current = `${position}-${appList[from].id}`;
    persist(
      () => reorderApplicationQuestions(position, ids),
      () => setAppItems(next),
      `질문을 ${to + 1}번째로 옮겼어요`,
    );
  }

  function addApplication(label: string) {
    const now = new Date().toISOString();
    const last = appList.at(-1)?.sort_order ?? -1;
    persist(
      () => createApplicationQuestion(position, label),
      () => setAppItems((items) => [...items, { id: nextLocalId(), position, label, sort_order: last + 1, created_by: null, created_at: now, updated_at: now }]),
      "질문을 추가했어요",
    );
  }

  function editApplication(question: ApplicationQuestion, label: string) {
    persist(
      () => updateApplicationQuestion(question.id, label),
      () => setAppItems((items) => items.map((item) => (item === question ? { ...item, label } : item))),
    );
  }

  function deleteApplication(question: ApplicationQuestion) {
    if (!window.confirm(`'${question.label}' 질문을 삭제할까요?\n이미 받은 답변은 지원서 상세에서 '삭제되거나 바뀐 질문'으로 보여요.`)) return;
    persist(
      () => deleteApplicationQuestion(question.id),
      () => setAppItems((items) => items.filter((item) => item !== question)),
      "질문을 삭제했어요",
    );
  }

  // ── 면접 질문
  const ivList = interviewQuestionsOf(ivItems, selected);
  const ivCommon = selected === "common" ? [] : interviewQuestionsOf(ivItems, "common");

  function addInterview(body: string) {
    const now = new Date().toISOString();
    const target = selected === "common" ? null : selected;
    persist(
      () => createInterviewQuestion(target, body),
      () => setIvItems((items) => [...items, { id: nextLocalId(), position: target, body, created_by: null, created_at: now, updated_at: now }]),
      "질문을 추가했어요",
    );
  }

  function editInterview(question: InterviewQuestion, body: string) {
    persist(
      () => updateInterviewQuestion(question.id, body),
      () => setIvItems((items) => items.map((item) => (item.id === question.id ? { ...item, body } : item))),
    );
  }

  function deleteInterview(question: InterviewQuestion) {
    if (!window.confirm(`'${question.body}' 질문을 삭제할까요?`)) return;
    persist(
      () => deleteInterviewQuestion(question.id),
      () => setIvItems((items) => items.filter((item) => item.id !== question.id)),
      "질문을 삭제했어요",
    );
  }

  const heading = `${keyLabel(selected)} · ${KIND_LABELS[kind]}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-gray-200 pb-5 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div>
            <p className="text-xs text-gray-500">{seasonLabel(season)}</p>
            <h1 className="text-2xl font-bold text-gray-900">질문 관리</h1>
          </div>
          <div role="tablist" aria-label="질문 종류" className="flex rounded-xl border border-gray-200 bg-gray-100 p-1">
            {(["application", "interview"] as const).map((value) => (
              <button
                key={value}
                id={`question-tab-${value}`}
                type="button"
                role="tab"
                aria-selected={kind === value}
                aria-controls="question-panel"
                tabIndex={kind === value ? 0 : -1}
                onClick={() => switchKind(value)}
                onKeyDown={onTabKeyDown}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                  kind === value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800",
                )}
              >
                {KIND_LABELS[value]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveStatus save={save} demo={demo} />
          {kind === "application" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="border border-gray-200"
              aria-expanded={templateOpen}
              aria-controls="question-templates"
              onClick={() => setTemplateOpen((open) => !open)}
            >
              템플릿
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-expanded={previewOpen}
            aria-controls="question-preview"
            onClick={() => setPreviewOpen((open) => !open)}
          >
            {previewOpen ? "미리보기 닫기" : "미리보기 열기"}
          </Button>
        </div>
      </header>
      {save.status === "error" && (
        <p role="alert" className="-mt-3 rounded-lg border border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
          저장하지 못했어요: {save.message}. 바꾸기 전 상태로 되돌렸어요. 잠시 뒤 다시 시도해주세요.
        </p>
      )}
      <p aria-live="polite" className="sr-only">{announcement}</p>

      <div className={cn("grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]", previewOpen && "xl:grid-cols-[13rem_minmax(0,1fr)_22rem]")}>
        <PositionPanel
          kind={kind}
          selected={selected}
          onSelect={setSelected}
          appItems={appItems}
          ivItems={ivItems}
        />

        <section id="question-panel" role="tabpanel" aria-labelledby={`question-tab-${kind}`} className="flex min-w-0 flex-col gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{heading}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {kind === "application"
                ? `지원자가 ${POSITION_LABELS[position]}를 선택하면 기본 정보 다음에 아래 질문이 이어져요. 모든 질문은 필수 장문으로 받아요.`
                : selected === "common"
                  ? "공통 질문은 모든 포지션 면접에 함께 보여요."
                  : `${POSITION_LABELS[position]} 지원자 면접에서 공통 질문과 함께 보여요. 면접 질문은 등록한 순서대로 보여요.`}
            </p>
            {kind === "application" && !openPositions.includes(position) && (
              <p className="mt-2 text-xs text-gray-500">지금 모집하지 않는 포지션이라 지원서 화면에는 보이지 않아요.</p>
            )}
          </div>

          {kind === "application" && templateOpen && (
            <TemplatePanel
              position={position}
              presets={presets.filter((preset) => preset.position === position)}
              questions={appList}
              demo={demo}
              disabled={saving}
              onSave={(name) => persist(() => saveApplicationQuestionPreset(position, name, appList.map((question) => question.label)), () => {}, "템플릿을 저장했어요")}
              onApply={(preset) => {
                if (!window.confirm(`${POSITION_LABELS[position]} 질문 ${appList.length}개를 모두 지우고 '${preset.name}' 질문 ${preset.questions.length}개로 바꿀까요?\n이미 받은 답변은 지원서 상세에서 '삭제되거나 바뀐 질문'으로 보여요.`)) return;
                persist(() => applyApplicationQuestionPreset(preset.id), () => {}, `'${preset.name}' 템플릿을 적용했어요`);
              }}
            />
          )}

          {kind === "interview" && selected !== "common" && (
            <CommonBlock count={ivCommon.length} onEdit={() => setSelected("common")}>
              {ivCommon.map((question) => (
                <li key={question.id} className="truncate border-t border-gray-200 py-2 text-sm text-gray-600">{question.body}</li>
              ))}
            </CommonBlock>
          )}

          <ol className="flex flex-col gap-2">
            {kind === "application"
              ? appList.map((question, index) => (
                  <QuestionCard
                    key={`${question.position}-${question.id}`}
                    id={`${question.position}-${question.id}`}
                    number={index + 1}
                    text={question.label}
                    badges={["장문", "필수"]}
                    disabled={saving}
                    move={{ index, count: appList.length, onMove: moveApplication }}
                    onEdit={(label) => editApplication(question, label)}
                    onCopy={() => addApplication(question.label)}
                    onDelete={() => deleteApplication(question)}
                  />
                ))
              : ivList.map((question, index) => (
                  <QuestionCard
                    key={question.id}
                    id={question.id}
                    number={index + 1}
                    text={question.body}
                    badges={[]}
                    disabled={saving}
                    onEdit={(body) => editInterview(question, body)}
                    onCopy={() => addInterview(question.body)}
                    onDelete={() => deleteInterview(question)}
                  />
                ))}
          </ol>
          {(kind === "application" ? appList : ivList).length === 0 && (
            <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">아직 질문이 없어요. 아래에서 첫 질문을 추가해보세요.</p>
          )}
          <AddQuestion
            key={`${kind}-${selected}`}
            disabled={saving}
            maxLength={kind === "application" ? 300 : undefined}
            onAdd={kind === "application" ? addApplication : addInterview}
          />
        </section>

        {previewOpen && (
          <aside
            id="question-preview"
            aria-label={kind === "application" ? "지원자 화면 미리보기" : "면접관 화면 미리보기"}
            className="min-w-0 rounded-2xl border border-gray-200 bg-white lg:col-start-2 xl:col-start-auto"
          >
            {kind === "application" ? (
              <ApplicantPreview position={position} questions={appList} />
            ) : (
              <InterviewerPreview selected={selected} questions={interviewerViewOrder(ivItems, selected)} />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function SaveStatus({ save, demo }: { save: SaveState; demo: boolean }) {
  const text = {
    idle: demo ? "둘러보기 · 저장되지 않아요" : "바꾸면 바로 저장돼요",
    saving: "저장 중…",
    saved: "변경사항 저장됨",
    demo: "둘러보기라 저장하지 않았어요",
    error: "저장 실패",
  }[save.status];
  return (
    <p aria-live="polite" className={cn("mr-1 text-xs", save.status === "error" ? "font-semibold text-danger" : "text-gray-500")}>
      {text}
    </p>
  );
}

function PositionPanel({
  kind,
  selected,
  onSelect,
  appItems,
  ivItems,
}: {
  kind: QuestionKind;
  selected: PositionKey;
  onSelect: (key: PositionKey) => void;
  appItems: ApplicationQuestion[];
  ivItems: InterviewQuestion[];
}) {
  const commonCount = interviewQuestionsOf(ivItems, "common").length;
  return (
    <nav aria-label="포지션" className="min-w-0">
      <p className="mb-2 hidden px-3 text-xs text-gray-500 lg:block">포지션</p>
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        <li className={cn("shrink-0 lg:mb-2 lg:block lg:border-b lg:border-gray-200 lg:pb-2", kind === "application" && "hidden")}>
          <PositionButton
            label="공통"
            sub={kind === "application" ? "지원서엔 아직 없어요" : "모든 포지션에 포함"}
            count={kind === "application" ? undefined : commonCount}
            active={kind === "interview" && selected === "common"}
            disabled={kind === "application"}
            onClick={() => onSelect("common")}
          />
        </li>
        {POSITIONS.map((item) => {
          const app = applicationQuestionsOf(appItems, item).length;
          const iv = interviewQuestionsOf(ivItems, item).length;
          return (
            <li key={item} className="shrink-0">
              <PositionButton
                label={POSITION_LABELS[item]}
                sub={`지원 ${app} · 면접 ${iv}`}
                count={kind === "application" ? app : iv}
                active={selected === item}
                onClick={() => onSelect(item)}
              />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function PositionButton({
  label,
  sub,
  count,
  active,
  disabled,
  onClick,
}: {
  label: string;
  sub: string;
  count?: number;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "true" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full min-w-36 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60",
        active ? "bg-white shadow-sm ring-1 ring-gray-200" : "hover:bg-gray-100",
      )}
    >
      <span className="min-w-0">
        <span className={cn("block text-sm", active ? "font-bold text-gray-900" : "font-medium text-gray-700")}>{label}</span>
        <span className="block truncate text-xs text-gray-500">{sub}</span>
      </span>
      {count !== undefined && <span className="text-sm tabular-nums text-gray-500">{count}</span>}
    </button>
  );
}

function CommonBlock({ count, onEdit, children }: { count: number; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {count === 0 ? "공통 질문이 없어요" : `공통 질문 ${count}개가 함께 보여요`}
        </p>
        <button type="button" onClick={onEdit} className="text-sm font-medium text-gray-700 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">
          공통에서 편집 →
        </button>
      </div>
      {count > 0 && <ul className="mt-2">{children}</ul>}
    </div>
  );
}

function QuestionCard({
  id,
  number,
  text,
  badges,
  disabled,
  move,
  onEdit,
  onCopy,
  onDelete,
}: {
  id: string;
  number: number;
  text: string;
  badges: string[];
  disabled: boolean;
  move?: { index: number; count: number; onMove: (from: number, to: number) => void };
  onEdit: (text: string) => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text);
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);

  function commit() {
    const next = value.trim();
    if (!next) return;
    setEditing(false);
    if (next !== text) onEdit(next);
  }

  return (
    <li
      draggable={!!move && dragging}
      onDragStart={(event) => {
        if (!move) return;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(move.index));
      }}
      onDragEnd={() => setDragging(false)}
      onDragOver={(event) => {
        if (!move || !event.dataTransfer.types.includes("text/plain")) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        setOver(false);
        if (!move) return;
        event.preventDefault();
        const from = Number(event.dataTransfer.getData("text/plain"));
        if (Number.isInteger(from) && from !== move.index) move.onMove(from, move.index);
      }}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-white px-3 py-3 transition-colors",
        over ? "border-primary" : "border-gray-200",
        dragging && "opacity-60",
      )}
    >
      {move && (
        <button
          type="button"
          data-move-handle={id}
          disabled={disabled}
          aria-label={`${number}번 질문 순서 옮기기. 위·아래 방향키로 옮겨요`}
          onPointerDown={() => setDragging(true)}
          onPointerUp={() => setDragging(false)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
            event.preventDefault();
            move.onMove(move.index, event.key === "ArrowUp" ? move.index - 1 : move.index + 1);
          }}
          className="shrink-0 cursor-grab rounded p-1 text-gray-400 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-primary active:cursor-grabbing"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <circle cx="7.5" cy="5" r="1.3" /><circle cx="12.5" cy="5" r="1.3" />
            <circle cx="7.5" cy="10" r="1.3" /><circle cx="12.5" cy="10" r="1.3" />
            <circle cx="7.5" cy="15" r="1.3" /><circle cx="12.5" cy="15" r="1.3" />
          </svg>
        </button>
      )}
      <span className="w-7 shrink-0 text-sm tabular-nums text-gray-400">Q{number}</span>
      {editing ? (
        <form
          className="flex min-w-[12rem] flex-1 flex-col gap-2 sm:flex-row sm:items-center"
          onSubmit={(event) => {
            event.preventDefault();
            commit();
          }}
        >
          <div className="min-w-0 flex-1">
            <Input
              aria-label={`${number}번 질문 내용`}
              value={value}
              autoFocus
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                setValue(text);
                setEditing(false);
              }}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={disabled || !value.trim()}>저장</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setValue(text); setEditing(false); }}>취소</Button>
          </div>
        </form>
      ) : (
        <>
          <button
            type="button"
            disabled={disabled}
            onClick={() => { setValue(text); setEditing(true); }}
            className="min-w-[12rem] flex-1 basis-0 rounded text-left text-sm font-semibold break-words text-gray-900 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
            aria-label={`${number}번 질문 수정: ${text}`}
          >
            {text}
          </button>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs">
            {badges.map((badge, index) => (
              <span key={badge} className={index === 0 ? "rounded-md border border-gray-200 px-2 py-0.5 text-gray-600" : "text-gray-500"}>{badge}</span>
            ))}
            {move && (
              <span className="flex">
                <IconButton label={`${number}번 질문 위로`} disabled={disabled || move.index === 0} onClick={() => move.onMove(move.index, move.index - 1)}>↑</IconButton>
                <IconButton label={`${number}번 질문 아래로`} disabled={disabled || move.index === move.count - 1} onClick={() => move.onMove(move.index, move.index + 1)}>↓</IconButton>
              </span>
            )}
            <button type="button" disabled={disabled} onClick={onCopy} className="rounded px-1 py-1 font-medium text-gray-600 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50" aria-label={`${number}번 질문 복사`}>복사</button>
            <button type="button" disabled={disabled} onClick={onDelete} className="rounded px-1 py-1 font-medium text-gray-600 hover:text-danger focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50" aria-label={`${number}번 질문 삭제`}>삭제</button>
          </div>
        </>
      )}
    </li>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-30"
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}

function AddQuestion({ disabled, maxLength, onAdd }: { disabled: boolean; maxLength?: number; onAdd: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="rounded-xl border border-dashed border-gray-300 py-3 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
      >
        + 질문 추가
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        const next = value.trim();
        if (!next) return;
        onAdd(next);
        setValue("");
        setOpen(false);
      }}
    >
      <div className="min-w-0 flex-1">
        <Input
          label="새 질문"
          value={value}
          autoFocus
          maxLength={maxLength}
          placeholder="예) 이 포지션에 지원한 이유를 알려주세요"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={disabled || !value.trim()}>추가</Button>
        <Button type="button" variant="ghost" onClick={() => { setValue(""); setOpen(false); }}>취소</Button>
      </div>
    </form>
  );
}

function TemplatePanel({
  position,
  presets,
  questions,
  demo,
  disabled,
  onSave,
  onApply,
}: {
  position: Position;
  presets: ApplicationQuestionPreset[];
  questions: ApplicationQuestion[];
  demo: boolean;
  disabled: boolean;
  onSave: (name: string) => void;
  onApply: (preset: ApplicationQuestionPreset) => void;
}) {
  const [name, setName] = useState("");
  return (
    <section id="question-templates" aria-label="질문 템플릿" className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">{POSITION_LABELS[position]} 질문 템플릿</h3>
      <p className="mt-1 text-xs text-gray-500">지금 질문 목록을 템플릿으로 저장해두고, 다음 모집 때 한 번에 적용할 수 있어요.</p>
      {demo && <p className="mt-2 text-xs text-gray-500">둘러보기에서는 템플릿을 저장하거나 적용할 수 없어요.</p>}
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          onSave(name.trim());
          setName("");
        }}
      >
        <div className="min-w-0 flex-1">
          <Input label="템플릿 이름" value={name} maxLength={100} placeholder="예) 2026 하반기 모집" onChange={(event) => setName(event.target.value)} disabled={demo} />
        </div>
        <Button type="submit" variant="secondary" disabled={demo || disabled || !name.trim() || questions.length === 0}>
          현재 질문 {questions.length}개 저장
        </Button>
      </form>
      {presets.length > 0 ? (
        <ul className="mt-4 flex flex-col divide-y divide-gray-200 border-t border-gray-200">
          {presets.map((preset) => (
            <li key={preset.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 text-sm text-gray-800">
                <span className="font-medium">{preset.name}</span>
                <span className="ml-2 text-xs text-gray-500">질문 {preset.questions.length}개</span>
              </span>
              <Button type="button" variant="ghost" size="sm" disabled={demo || disabled} onClick={() => onApply(preset)}>적용</Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-gray-500">저장된 템플릿이 없어요.</p>
      )}
    </section>
  );
}

function PreviewHeader({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
      <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      <p className="text-xs text-gray-500">{meta}</p>
    </div>
  );
}

/** /apply의 ApplyForm과 같은 모양: 질문마다 필수 장문 입력. 입력은 막아 둔다. */
function ApplicantPreview({ position, questions }: { position: Position; questions: ApplicationQuestion[] }) {
  return (
    <div>
      <PreviewHeader title="지원자 화면" meta={`${POSITION_LABELS[position]} · ${questions.length}문항`} />
      <div className="flex flex-col gap-5 p-4">
        <p className="text-xs text-gray-500">이름·학번 등 기본 정보 다음에 이어져요.</p>
        {questions.length === 0 && <p className="text-sm text-gray-500">보여줄 질문이 없어요.</p>}
        {questions.map((question, index) => (
          <label key={`${question.position}-${question.id}`} className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-gray-900">
              {index + 1}. {question.label} <span className="text-danger" aria-label="필수">*</span>
            </span>
            <textarea disabled rows={4} className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
          </label>
        ))}
      </div>
    </div>
  );
}

/** 지원서 상세의 면접 질문 목록과 같은 순서·모양(공통 포함, 등록 순서). */
function InterviewerPreview({ selected, questions }: { selected: PositionKey; questions: InterviewQuestion[] }) {
  return (
    <div>
      <PreviewHeader title="면접관 화면" meta={`${keyLabel(selected)} · ${questions.length}문항`} />
      <div className="p-4">
        <p className="mb-3 text-xs text-gray-500">지원서 상세의 면접 질문 목록에 이 순서로 보여요.</p>
        {questions.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 면접 질문이 없어요.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {questions.map((question, index) => (
              <li key={question.id} className="flex gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
                <span className="font-semibold text-primary">Q{index + 1}</span>
                <span className="min-w-0 flex-1 whitespace-pre-wrap">{question.body}</span>
                {question.position === null && selected !== "common" && <span className="shrink-0 text-xs text-gray-500">공통</span>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
