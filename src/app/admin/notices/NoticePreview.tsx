import { composeNoticeBody, type NoticeDetails } from "@/lib/notice-body";

interface NoticePreviewProps {
  title: string;
  details: NoticeDetails;
}

/** 회원 공지 상세((member)/notices/[id])와 같은 방식으로 제목과 합쳐진 본문을 보여 준다. */
export function NoticePreview({ title, details }: NoticePreviewProps) {
  const body = composeNoticeBody(details);

  return (
    <aside aria-labelledby="notice-preview-title" className="flex flex-col gap-3 lg:sticky lg:top-6">
      <div className="flex items-center justify-between gap-2">
        <h2 id="notice-preview-title" className="text-sm font-semibold text-gray-700">
          회원에게 이렇게 보여요
        </h2>
        <span className="text-xs text-gray-400">입력하면 바로 바뀌어요</span>
      </div>
      <article className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-6 dark:bg-gray-100">
        <span className="self-start rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-200">
          미발행
        </span>
        <h3 className={title.trim() ? "text-xl font-bold text-gray-900" : "text-xl font-bold text-gray-400"}>
          {title.trim() || "제목을 입력하면 여기에 보여요"}
        </h3>
        <p className={body ? "whitespace-pre-wrap text-sm text-gray-700" : "text-sm text-gray-400"}>
          {body || "일정·장소·준비물과 본문을 입력하면 여기에 보여요."}
        </p>
      </article>
      <p className="flex items-center gap-1.5 text-xs text-gray-400">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
          <circle cx="10" cy="10" r="7.5" />
          <path d="M10 9v4.5M10 6.5h.01" />
        </svg>
        발행할 때 슬랙 #공지 채널 전송 여부를 고를 수 있어요.
      </p>
    </aside>
  );
}
