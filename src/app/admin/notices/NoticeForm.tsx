"use client";

import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createNotice, saveNoticeTemplate, updateNotice } from "@/actions/notice";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import { Select } from "@/components/Select";
import { DatePicker } from "@/components/DatePicker";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import { composeNoticeBody, parseNoticeBody, type NoticeDetails } from "@/lib/notice-body";
import type { Notice, Place } from "@/lib/types";
import { NoticePreview } from "./NoticePreview";
import { NoticeSourcePicker, type NoticeSource } from "./NoticeSourcePicker";
import { SuppliesInput } from "./SuppliesInput";

interface NoticeFormProps {
  notice?: Notice;
  places?: Place[];
  /** 새 공지 작성에서만: 불러올 최근 공지·템플릿 */
  sources?: NoticeSource[];
  supplySuggestions?: string[];
}

/** 불러오기·처음부터 쓰기로 폼을 다시 채울 때 쓰는 초기값. key가 바뀌면 입력칸이 새 값으로 다시 그려진다. */
interface Seed {
  key: number;
  title: string;
  details: NoticeDetails;
  from?: NoticeSource;
}

const EMPTY_DETAILS: NoticeDetails = { schedule: "", place: "", supplies: "", body: "" };

/** 폼에 지금 적힌 값을 공지 본문 형식으로 합친다. 템플릿 저장은 일정을 뺀다. */
function readForm(form: HTMLFormElement, withSchedule: boolean) {
  const data = new FormData(form);
  return {
    title: String(data.get("title") ?? ""),
    body: composeNoticeBody({
      schedule: withSchedule ? String(data.get("schedule") ?? "") : "",
      place: String(data.get("place") ?? ""),
      supplies: String(data.get("supplies") ?? ""),
      body: String(data.get("body") ?? ""),
    }),
  };
}

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
    >
      <circle cx="12" cy="12" r="9" strokeOpacity={0.3} />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </svg>
  );
}

/** 새 공지: 폼(최대 40rem) + 오른쪽 미리보기. 수정 화면은 페이지가 감싼 Card 안에 폼만 둔다. */
function FormLayout({ preview, children }: { preview?: ReactNode; children: ReactNode }) {
  if (!preview) return <>{children}</>;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,40rem)_minmax(0,1fr)]">
      <Card className="flex flex-col gap-4">{children}</Card>
      {preview}
    </div>
  );
}

export function NoticeForm({
  notice,
  places = [],
  sources,
  supplySuggestions = [],
}: NoticeFormProps) {
  const router = useRouter();
  const bodyId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [seed, setSeed] = useState<Seed>(() => ({
    key: 0,
    title: notice?.title ?? "",
    details: parseNoticeBody(notice?.body ?? ""),
  }));
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateError, setTemplateError] = useState<string>();
  const [templateSaved, setTemplateSaved] = useState<string>();
  const [templatePending, startTemplateTransition] = useTransition();
  // 미리보기용 현재 입력값. 입력칸은 그대로 비제어로 두고 바뀔 때마다 따라 적는다
  const [values, setValues] = useState(() => ({ title: seed.title, ...seed.details }));

  function updateValue(field: keyof typeof values, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  const details = seed.details;
  // 풀에서 사라진 장소(삭제 등)도 선택지로 남겨 수정·불러오기 때 값이 날아가지 않게 한다
  const missingPlace =
    details.place && !places.some((p) => p.name === details.place) ? details.place : "";

  function reseed(title: string, next: NoticeDetails, from?: NoticeSource) {
    setError(undefined);
    setSeed((prev) => ({ key: prev.key + 1, title, details: next, from }));
    setValues({ title, ...next });
  }

  function pickSource(source: NoticeSource) {
    // 날짜는 매번 다르니 옮기지 않는다
    reseed(source.title, { ...parseNoticeBody(source.body), schedule: "" }, source);
  }

  function openTemplateDialog() {
    setTemplateError(undefined);
    setTemplateName(seed.from?.kind === "template" ? seed.from.label : "");
    setTemplateOpen(true);
  }

  function handleSaveTemplate() {
    const form = formRef.current;
    if (!form) return;
    const { title, body } = readForm(form, false);
    const formData = new FormData();
    formData.set("name", templateName);
    formData.set("title", title);
    formData.set("body", body);
    setTemplateError(undefined);
    startTemplateTransition(async () => {
      const result = await saveNoticeTemplate(formData);
      if (result?.error) {
        setTemplateError(result.error);
        return;
      }
      setTemplateOpen(false);
      setTemplateSaved(`‘${templateName.trim()}’ 템플릿으로 저장했어요.`);
      router.refresh();
    });
  }

  function handleSubmit(formData: FormData) {
    setError(undefined);
    const form = formRef.current;
    if (!form) return;
    const { body } = readForm(form, true);
    formData.set("body", body);
    formData.delete("schedule");
    formData.delete("place");
    formData.delete("supplies");
    startTransition(async () => {
      const result = notice
        ? await updateNotice(notice.id, formData)
        : await createNotice(formData);

      if (result?.error) {
        setError(result.error);
        return;
      }

      if (notice) {
        router.refresh();
      } else {
        router.push("/admin/notices");
      }
    });
  }

  return (
    <>
    <FormLayout
      preview={
        sources && (
          <NoticePreview
            title={values.title}
            details={{ schedule: values.schedule, place: values.place, supplies: values.supplies, body: values.body }}
          />
        )
      }
    >
    {sources && (
      <NoticeSourcePicker sources={sources} pickedId={seed.from?.id} onPick={pickSource} />
    )}
    <form
      ref={formRef}
      action={handleSubmit}
      onInput={(e) => {
        const target = e.target as HTMLInputElement | HTMLTextAreaElement;
        if (target.name === "title" || target.name === "body") updateValue(target.name, target.value);
      }}
      className="flex flex-col gap-4"
    >
      {notice && (
        <div className="-mx-6 -mt-6 border-b border-gray-100 px-6 pb-4 pt-6">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 text-gray-500"
            >
              <path d="M7.5 10.5h3.5M7.5 13.5h2" />
              <path d="m14.5 8.5-3.4 3.4-1.2.4.4-1.2 3.4-3.4a.85.85 0 0 1 1.2 0l-.4-.4a.85.85 0 0 1 0 1.2Z" />
              <path d="M5 3.5A1.5 1.5 0 0 1 6.5 2h5.086a1.5 1.5 0 0 1 1.06.44l2.415 2.414a1.5 1.5 0 0 1 .439 1.061V16.5A1.5 1.5 0 0 1 14 18H6.5A1.5 1.5 0 0 1 5 16.5v-13Z" />
            </svg>
            공지 내용 수정
          </h2>
        </div>
      )}
      {seed.from && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md bg-primary-soft px-3 py-2 text-xs text-gray-800"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 shrink-0 text-primary"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="7.5" />
            <path d="m7 10 2 2 4-4" />
          </svg>
          <span className="flex-1">‘{seed.from.label}’ 내용을 불러왔어요. 일정만 새로 골라 주세요.</span>
          <button
            type="button"
            onClick={() => reseed("", EMPTY_DETAILS)}
            className="shrink-0 font-medium text-primary hover:underline"
          >
            처음부터 쓰기
          </button>
        </div>
      )}
      <div key={seed.key} className="contents">
      <Input
        name="title"
        label="제목"
        defaultValue={seed.title}
        placeholder="예) 8월 정기 세션 일정 안내"
        required
        style={error ? { borderColor: "var(--color-danger)" } : undefined}
      />
      {error && (
        <p className="flex items-center gap-1.5 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 shrink-0"
          >
            <circle cx="10" cy="10" r="7.5" />
            <path d="M10 6.5v4M10 13.5h.01" />
          </svg>
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
        <DatePicker
          withTime
          name="schedule"
          label={
            <>
              일정{" "}
              <span className="font-normal text-gray-400">선택 · KST 기준</span>
            </>
          }
          defaultValue={details.schedule}
          onChange={(value) => updateValue("schedule", value)}
        />
        {seed.from && (
          <p className="text-xs text-primary">불러온 공지의 날짜는 옮기지 않았어요.</p>
        )}
        </div>
        <div className="flex flex-col gap-1">
        <Select
          name="place"
          label={
            <>
              장소 <span className="font-normal text-gray-400">선택</span>
            </>
          }
          defaultValue={details.place}
          onChange={(e) => updateValue("place", e.target.value)}
        >
          <option value="">장소 없음</option>
          {places.map((place) => (
            <option key={place.id} value={place.name}>
              {place.name}
            </option>
          ))}
          {missingPlace && <option value={missingPlace}>{missingPlace}</option>}
        </Select>
        <p className="text-xs text-gray-400">
          원하는 장소가 없으면{" "}
          <Link href="/admin/places" className="text-primary hover:underline">
            장소 관리
          </Link>
          에서 추가해요.
        </p>
        </div>
      </div>
      <SuppliesInput
        name="supplies"
        label={
          <>
            준비물 <span className="font-normal text-gray-400">선택</span>
          </>
        }
        defaultValue={details.supplies}
        suggestions={supplySuggestions}
        onChange={(value) => updateValue("supplies", value)}
      />
      <Textarea
        id={bodyId}
        name="body"
        rows={8}
        defaultValue={details.body}
        label={
          <>
            본문{" "}
            {!notice && (
              <span className="font-normal text-gray-400">
                회원에게 보일 공지 내용
              </span>
            )}
          </>
        }
        placeholder={
          "공지 내용을 작성해 주세요.\n\n· 위에 적은 일정·장소·준비물은 본문 맨 앞에 자동으로 붙어요.\n· 발행할 때 슬랙 #공지 채널 전송 여부를 고를 수 있어요."
        }
      />
      </div>
      {templateSaved && (
        <p role="status" className="text-xs text-success">
          {templateSaved}
        </p>
      )}
      <div className={sources ? "mt-2 flex items-center justify-between gap-2" : "mt-2 flex"}>
        {sources && (
          <Button type="button" variant="ghost" className="shrink-0 gap-1.5 text-primary" onClick={openTemplateDialog}>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M5 3.5h8l3 3V16a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 4 16V4a.5.5 0 0 1 .5-.5Z" />
              <path d="M7 3.5V7h5V3.5M7 16.5v-5h6v5" />
            </svg>
            템플릿으로 저장
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          className={sources ? "gap-1.5 px-6" : "w-full gap-1.5"}
          disabled={pending}
        >
          {pending && <Spinner />}
          {notice ? (pending ? "수정 중..." : "수정") : pending ? "생성 중..." : "공지 생성"}
        </Button>
      </div>
    </form>
    </FormLayout>
    {sources && (
      <Modal open={templateOpen} onClose={() => setTemplateOpen(false)} ariaLabel="템플릿으로 저장">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveTemplate();
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-gray-900">템플릿으로 저장</h2>
            <p className="text-xs text-gray-500">
              지금 쓴 제목·장소·준비물·본문을 다음 공지의 출발점으로 저장해요. 일정은 저장하지 않아요.
            </p>
          </div>
          <Input
            label="템플릿 이름"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="예) 정기 세션"
            maxLength={40}
            required
            error={templateError}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setTemplateOpen(false)}>
              취소
            </Button>
            <Button type="submit" variant="primary" className="gap-1.5" disabled={templatePending}>
              {templatePending && <Spinner />}
              {templatePending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </form>
      </Modal>
    )}
    </>
  );
}
