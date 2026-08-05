import { afterEach, describe, expect, it, vi } from "vitest";

const postMessage = vi.fn();

vi.mock("@/lib/slack/api", () => ({
  postMessage: (...args: unknown[]) => postMessage(...args),
}));

const { sendInquiryNotification } = await import("@/lib/inquiry-notification");

const INPUT = {
  category: "bug" as const,
  title: "공지사항 카드 테마 컬러토큰 버그",
  body: "다크모드에서 카드 BG가 라이트 기준으로 적용돼요",
  author: "Sun(문선우)",
  createdAt: "2026-08-02T08:50:00.000Z",
};

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.SLACK_ADMIN_CHANNEL_ID;
  delete process.env.SLACK_JARVIS_BOT_TOKEN;
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

function configured() {
  process.env.SLACK_ADMIN_CHANNEL_ID = "C_ADMIN";
  process.env.SLACK_JARVIS_BOT_TOKEN = "xoxb-jarvis";
  process.env.NEXT_PUBLIC_SITE_URL = "https://gdg-homepage.vercel.app";
}

describe("sendInquiryNotification", () => {
  it("Jarvis가 제목·본문·작성자·작성시각을 운영진 채널로 보낸다", async () => {
    configured();
    postMessage.mockResolvedValue({ ok: true, ts: "1.2" });

    await expect(sendInquiryNotification(INPUT)).resolves.toEqual({});

    const call = postMessage.mock.calls[0][0];
    expect(call.channel).toBe("C_ADMIN");
    expect(call.botToken).toBe("xoxb-jarvis");
    expect(call.text).toContain("(버그)");
    expect(call.text).toContain(INPUT.title);
    expect(call.text).toContain(INPUT.body);
    expect(call.text).toContain("Sun(문선우) · 2026. 8. 2. 오후 5:50");
    expect(call.text).toContain("https://gdg-homepage.vercel.app/admin/inquiries");
  });

  it("긴 본문은 잘라서 보낸다", async () => {
    configured();
    postMessage.mockResolvedValue({ ok: true, ts: "1.2" });

    await sendInquiryNotification({ ...INPUT, body: "가".repeat(400) });

    expect(postMessage.mock.calls[0][0].text).toContain(`${"가".repeat(300)}...`);
  });

  it("Jarvis 토큰이 없으면 꼬북봇으로 폴백하지 않고 에러를 돌려준다", async () => {
    process.env.SLACK_ADMIN_CHANNEL_ID = "C_ADMIN";

    const result = await sendInquiryNotification(INPUT);

    expect(result.error).toContain("SLACK_JARVIS_BOT_TOKEN");
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("전송 실패는 에러로 돌려준다", async () => {
    configured();
    postMessage.mockResolvedValue({ ok: false, error: "not_in_channel" });

    await expect(sendInquiryNotification(INPUT)).resolves.toEqual({
      error: "슬랙 문의 알림에 실패했어요 (not_in_channel)",
    });
  });
});
