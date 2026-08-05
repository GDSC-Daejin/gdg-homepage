import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const openDirectMessage = vi.fn();
const postMessage = vi.fn();
vi.mock("@/lib/slack/api", () => ({
  openDirectMessage: (...args: unknown[]) => openDirectMessage(...args),
  postMessage: (...args: unknown[]) => postMessage(...args),
}));

const { nudgeParticipants } = await import("@/lib/meeting-poll-nudge");

function pendingClient() {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockResolvedValue({
    data: [{ name: "Lumi(유림)", profiles: { slack_user_id: "U_LUMI" } }],
  });
  return { from: vi.fn(() => query) } as unknown as SupabaseClient;
}

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.SLACK_JARVIS_BOT_TOKEN;
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

describe("nudgeParticipants", () => {
  it("모지숲이 아닌 일정은 미응답 참여자에게 Jarvis DM을 보낸다", async () => {
    process.env.SLACK_JARVIS_BOT_TOKEN = "xoxb-jarvis";
    process.env.NEXT_PUBLIC_SITE_URL = "https://gdg.example.com";
    openDirectMessage.mockResolvedValue({ ok: true, channel: "D_LUMI" });
    postMessage.mockResolvedValue({ ok: true, ts: "1" });

    await nudgeParticipants(
      pendingClient(),
      { id: "poll-1", title: "디자이너 작당모의" },
    );

    expect(openDirectMessage).toHaveBeenCalledWith({ user: "U_LUMI", botToken: "xoxb-jarvis" });
    expect(postMessage).toHaveBeenCalledWith({
      channel: "D_LUMI",
      botToken: "xoxb-jarvis",
      text: '[스케줄] "디자이너 작당모의" 응답을 부탁드려요.\nhttps://gdg.example.com/schedule/poll-1',
    });
  });

  it("정기세션은 모지숲 설정과 무관하게 미응답 참여자에게 DM을 보낸다", async () => {
    process.env.SLACK_JARVIS_BOT_TOKEN = "xoxb-jarvis";
    openDirectMessage.mockResolvedValue({ ok: true, channel: "D_LUMI" });
    postMessage.mockResolvedValue({ ok: true, ts: "1" });

    await nudgeParticipants(
      pendingClient(),
      { id: "poll-1", title: "정기세션" },
    );

    expect(openDirectMessage).toHaveBeenCalledWith({ user: "U_LUMI", botToken: "xoxb-jarvis" });
  });
});
