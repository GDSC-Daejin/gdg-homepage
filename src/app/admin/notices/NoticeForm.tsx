"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createNotice, updateNotice } from "@/actions/notice";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import { Select } from "@/components/Select";
import { DatePicker } from "@/components/DatePicker";
import { Button } from "@/components/Button";
import { composeNoticeBody, parseNoticeBody } from "@/lib/notice-body";
import type { Notice, Place } from "@/lib/types";

interface NoticeFormProps {
  notice?: Notice;
  places?: Place[];
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

export function NoticeForm({ notice, places = [] }: NoticeFormProps) {
  const router = useRouter();
  const bodyId = useId();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const details = parseNoticeBody(notice?.body ?? "");
  // 풀에서 사라진 장소(삭제 등)도 선택지로 남겨 수정 시 값이 날아가지 않게 한다
  const missingPlace =
    details.place && !places.some((p) => p.name === details.place) ? details.place : "";

  function handleSubmit(formData: FormData) {
    setError(undefined);
    formData.set(
      "body",
      composeNoticeBody({
        schedule: String(formData.get("schedule") ?? ""),
        place: String(formData.get("place") ?? ""),
        supplies: String(formData.get("supplies") ?? ""),
        body: String(formData.get("body") ?? ""),
      }),
    );
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
    <form action={handleSubmit} className="flex flex-col gap-4">
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
      <Input
        name="title"
        label={
          notice ? (
            "제목"
          ) : (
            <>
              제목 <span className="text-danger">*</span>
            </>
          )
        }
        defaultValue={notice?.title}
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
        />
        <Select
          name="place"
          label={
            <>
              장소 <span className="font-normal text-gray-400">선택</span>
            </>
          }
          defaultValue={details.place}
        >
          <option value="">장소 없음</option>
          {places.map((place) => (
            <option key={place.id} value={place.name}>
              {place.name}
            </option>
          ))}
          {missingPlace && <option value={missingPlace}>{missingPlace}</option>}
        </Select>
      </div>
      <p className="-mt-2 text-xs text-gray-400">
        장소는{" "}
        <a href="/admin/places" className="text-primary hover:underline">
          장소 관리
        </a>
        에서 추가해요.
      </p>
      <Input
        name="supplies"
        label={
          <>
            준비물 <span className="font-normal text-gray-400">선택</span>
          </>
        }
        placeholder="예) 노트북, 충전기"
        defaultValue={details.supplies}
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
      <Button
        type="submit"
        variant="primary"
        className="mt-2 w-full gap-1.5"
        disabled={pending}
      >
        {pending && <Spinner />}
        {notice ? (pending ? "수정 중..." : "수정") : pending ? "생성 중..." : "생성"}
      </Button>
    </form>
  );
}
