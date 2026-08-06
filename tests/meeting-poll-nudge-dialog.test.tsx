import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NudgeDialog } from "@/app/schedule/[id]/PollDetailDialogs";

describe("일정 조사 알림 모달", () => {
  it("모든 일정에서 Slack 개인 DM 발송을 안내한다", () => {
    const markup = renderToStaticMarkup(<NudgeDialog count={5} busy={false} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(markup).toContain("Slack 개인 DM");
  });
});
