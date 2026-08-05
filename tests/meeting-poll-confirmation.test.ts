import { afterEach, describe, expect, it, vi } from "vitest";

const postMessage = vi.fn();
const addReaction = vi.fn();
const openDirectMessage = vi.fn();

vi.mock("@/lib/slack/api", () => ({
  postMessage: (...args: unknown[]) => postMessage(...args),
  addReaction: (...args: unknown[]) => addReaction(...args),
  openDirectMessage: (...args: unknown[]) => openDirectMessage(...args),
}));

const { sendMeetingPollConfirmation } = await import("@/lib/meeting-poll-confirmation");

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.SLACK_ADMIN_CHANNEL_ID;
  delete process.env.SLACK_NOTICE_CHANNEL_ID;
  delete process.env.SLACK_JARVIS_BOT_TOKEN;
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

function configured() {
  process.env.SLACK_ADMIN_CHANNEL_ID = "C_ADMIN";
  process.env.SLACK_JARVIS_BOT_TOKEN = "xoxb-jarvis";
  process.env.NEXT_PUBLIC_SITE_URL = "https://gdg-homepage.vercel.app";
}

describe("sendMeetingPollConfirmation", () => {
  it("Jarvis가 채널 멘션 확정 알림과 확인 이모지 반응을 남긴다", async () => {
    configured();
    postMessage.mockResolvedValue({ ok: true, ts: "123.456" });
    addReaction.mockResolvedValue({ ok: true });

    await expect(
      sendMeetingPollConfirmation({
        id: "poll-1",
        title: "8월 정기 회의",
        startIso: "2026-08-04T10:30:00.000Z",
        durationMin: 60,
      }),
    ).resolves.toBeUndefined();

    expect(postMessage).toHaveBeenCalledWith({
      channel: "C_ADMIN",
      botToken: "xoxb-jarvis",
      text: expect.stringContaining("<!channel>"),
    });
    expect(postMessage.mock.calls[0][0].text).toContain(":cb3dc3d2-fd74-4a3b-a9e1-f7ad58497090: 이모지로 확인해주세요");
    expect(postMessage.mock.calls[0][0].text).toContain("https://gdg-homepage.vercel.app/schedule/poll-1");
    expect(addReaction).toHaveBeenCalledWith({
      channel: "C_ADMIN",
      ts: "123.456",
      emoji: "cb3dc3d2-fd74-4a3b-a9e1-f7ad58497090",
      botToken: "xoxb-jarvis",
    });
  });

  it("이모지 반응 실패는 확정 알림 경고로 돌려준다", async () => {
    configured();
    postMessage.mockResolvedValue({ ok: true, ts: "123.456" });
    addReaction.mockResolvedValue({ ok: false, error: "invalid_name" });

    await expect(
      sendMeetingPollConfirmation({
        id: "poll-1",
        title: "8월 정기 회의",
        startIso: "2026-08-04T10:30:00.000Z",
        durationMin: 60,
      }),
    ).resolves.toContain("확인 이모지 반응");
  });

  it("모지숲이 아닌 일정은 참여자 DM으로 확정 시각을 보낸다", async () => {
    configured();
    openDirectMessage.mockResolvedValue({ ok: true, channel: "D_LUMI" });
    postMessage.mockResolvedValue({ ok: true, ts: "123.456" });
    addReaction.mockResolvedValue({ ok: true });

    await expect(
      sendMeetingPollConfirmation({
        id: "poll-1",
        title: "디자이너 작당모의",
        startIso: "2026-08-04T10:30:00.000Z",
        durationMin: 60,
        isMojisoop: false,
        slackUserIds: ["U_LUMI"],
      }),
    ).resolves.toBeUndefined();

    expect(openDirectMessage).toHaveBeenCalledWith({ user: "U_LUMI", botToken: "xoxb-jarvis" });
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      channel: "D_LUMI",
      botToken: "xoxb-jarvis",
      text: expect.stringContaining('"디자이너 작당모의" 일정이 확정됐어요'),
    }));
    expect(addReaction).not.toHaveBeenCalled();
  });

  it("정기세션 일정은 공지사항 채널로 확정 알림을 보낸다", async () => {
    configured();
    process.env.SLACK_NOTICE_CHANNEL_ID = "C_NOTICE";
    postMessage.mockResolvedValue({ ok: true, ts: "123.456" });

    await expect(
      sendMeetingPollConfirmation({
        id: "poll-1",
        title: "8월 정기세션",
        startIso: "2026-08-04T10:30:00.000Z",
        durationMin: 60,
        isMojisoop: false,
        isRegularSession: true,
      }),
    ).resolves.toBeUndefined();

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      channel: "C_NOTICE",
      botToken: "xoxb-jarvis",
      text: expect.stringContaining("[정기세션]"),
    }));
    expect(openDirectMessage).not.toHaveBeenCalled();
  });
});
