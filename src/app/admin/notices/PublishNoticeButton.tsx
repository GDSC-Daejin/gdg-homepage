"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishNotice } from "@/actions/notice";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";

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

function SendIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m17 3-7.5 7.5M17 3l-5.5 14-3-6.5L2 7.5 17 3Z" />
    </svg>
  );
}

function StatusIcon({ tone }: { tone: "success" | "danger" }) {
  if (tone === "success") {
    return (
      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success text-white">
        <svg
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-2.5 w-2.5"
        >
          <path d="M2.5 6.2 4.8 8.5 9.5 3.5" />
        </svg>
      </div>
    );
  }
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className="mt-0.5 h-4 w-4 shrink-0"
    >
      <circle cx="10" cy="10" r="7.25" />
      <path d="M10 6.5v4M10 13.5h.01" />
    </svg>
  );
}

export function PublishNoticeButton({
  noticeId,
  published,
  onPendingChange,
}: {
  noticeId: string;
  published: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [slackMessage, setSlackMessage] = useState<string>();
  const [notifySlack, setNotifySlack] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  function handlePublish() {
    setError(undefined);
    setSlackMessage(undefined);
    startTransition(async () => {
      const result = await publishNotice(noticeId, notifySlack);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result?.slack) setSlackMessage(result.slack);
      router.refresh();
    });
  }

  if (published && !slackMessage) return null;

  const slackFailed = slackMessage?.startsWith("슬랙 전송 실패");
  const slackSkipped = slackMessage === "슬랙 전송 없이 발행";

  return (
    // relative: 상태 안내는 아래 absolute 오버레이로 띄워 헤더/폼 레이아웃을 밀지 않음
    <div className="relative flex flex-col items-end gap-1">
      {!published && (
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600">
            슬랙 <span className="font-medium">#공지</span> 발송
            <button
              type="button"
              role="switch"
              aria-checked={notifySlack}
              aria-label={`슬랙 발송 ${notifySlack ? "끄기" : "켜기"}`}
              disabled={pending}
              onClick={() => setNotifySlack((on) => !on)}
              className={cn(
                "flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50",
                notifySlack ? "bg-primary" : "bg-gray-300",
              )}
            >
              <span
                className={cn(
                  "h-4 w-4 rounded-full bg-white shadow transition-transform",
                  notifySlack && "translate-x-4",
                )}
              />
            </button>
          </label>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handlePublish}
            disabled={pending}
            className="gap-1.5"
          >
            {pending ? <Spinner /> : <SendIcon />}
            {pending ? "발행 중" : "발행"}
          </Button>
        </div>
      )}
      <div className="absolute right-0 top-full z-20 mt-2 flex w-max max-w-[280px] flex-col items-end gap-1">
        {pending && (
          <p className="rounded-md bg-gray-100 px-2 py-1 text-right text-[11px] text-gray-500">
            슬랙 전송을 기다리는 동안 두 버튼 모두 비활성화돼 중복 발행을 막아요.
          </p>
        )}
        {error && (
          <div className="flex items-start gap-1.5 rounded-md bg-danger-soft px-2 py-1 text-xs text-danger shadow-sm">
            <StatusIcon tone="danger" />
            <p>발행 실패: {error}</p>
          </div>
        )}
        {slackMessage && (
          <div
            className={cn(
              "flex items-start gap-1.5 rounded-md px-2 py-1 text-xs shadow-sm",
              slackFailed ? "bg-danger-soft text-danger" : "bg-success-soft text-success",
            )}
          >
            <StatusIcon tone={slackFailed ? "danger" : "success"} />
            <div>
              <p className="font-medium">
                {slackFailed ? "슬랙 전송에 실패했어요" : "발행이 완료됐어요"}
              </p>
              <p className="mt-0.5 opacity-80">
                {slackFailed ? (
                  "잠시 후 다시 시도해 주세요."
                ) : slackSkipped ? (
                  "슬랙 발송 없이 회원에게만 노출돼요."
                ) : (
                  <>
                    슬랙 <span className="font-medium">#공지</span> 채널로 공지가 전달됐어요. 이제
                    회원에게도 노출돼요.
                  </>
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
