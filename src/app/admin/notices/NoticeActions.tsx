"use client";

import { useState } from "react";
import { PublishNoticeButton } from "./PublishNoticeButton";
import { DeleteNoticeButton } from "./DeleteNoticeButton";

export function NoticeActions({
  noticeId,
  published,
  title,
}: {
  noticeId: string;
  published: boolean;
  title: string;
}) {
  const [publishing, setPublishing] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <PublishNoticeButton
        noticeId={noticeId}
        published={published}
        onPendingChange={setPublishing}
      />
      <DeleteNoticeButton noticeId={noticeId} title={title} disabled={publishing} />
    </div>
  );
}
