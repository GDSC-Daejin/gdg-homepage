import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { slotIso } from "@/lib/meeting-poll";

const postMessage = vi.fn();
vi.mock("@/lib/slack/api", () => ({
  postMessage: (...args: unknown[]) => postMessage(...args),
}));

const { allRespondedMessage, notifyAllResponded, notifyAllRespondedByToken } =
  await import("@/lib/meeting-poll-all-responded");

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

const POLL = {
  id: "c3e2665e-c41a-4827-b383-c98bec6e7fba",
  title: "8월 정기 회의",
  dates: ["2026-08-12", "2026-08-13"],
  start_hour: 18,
  end_hour: 22,
  slot_min: 30,
  is_regular_session: false,
};

/** 12일 19:00~20:00은 전원, 13일 20:00~21:00은 2명만 */
function claim() {
  const day1 = ["19:00", "19:30"].map((t) => slotIso("2026-08-12", t));
  const day2 = ["20:00", "20:30"].map((t) => slotIso("2026-08-13", t));
  return {
    poll: POLL,
    slots: [
      [...day1, ...day2],
      [...day1, ...day2],
      [...day1],
    ],
  };
}

function fakeClient(rpcResult: unknown) {
  const rpc = vi.fn().mockResolvedValue({ data: rpcResult, error: null });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("allRespondedMessage", () => {
  it("전원 응답 인원과 확정 링크를 담는다", () => {
    const text = allRespondedMessage(claim(), "https://gdg-homepage.vercel.app");
    expect(text).toContain("전원 응답이 끝났어요 (3/3명)");
    expect(text).toContain("이제 일정을 확정해주세요");
    expect(text).toContain(`<https://gdg-homepage.vercel.app/schedule/${POLL.id}|일정 확정하러 가기>`);
  });

  it("가장 많이 겹치는 시간을 순위로 보여준다", () => {
    const text = allRespondedMessage(claim(), "https://gdg-homepage.vercel.app");
    expect(text).toContain("🥇 8월 12일 (수) 오후 7:00 · 1시간 · 전원 가능");
    expect(text).toContain("🥈 8월 13일 (목) 오후 8:00 · 1시간 · 2명 가능");
  });

  it("겹치는 구간이 없으면 추천 없이 확정 요청만 보낸다", () => {
    const text = allRespondedMessage({ poll: POLL, slots: [[], []] }, "https://x.dev");
    expect(text).not.toContain("가장 많이 겹치는 시간");
    expect(text).toContain("(2/2명)");
  });

  it("참여자 이름을 노출하지 않는다", () => {
    // 선점 RPC가 이름을 아예 안 돌려준다 — 문구가 이름에 기대면 안 된다
    const text = allRespondedMessage(claim(), "https://x.dev");
    expect(text).not.toContain("undefined");
  });
});

describe("notifyAllResponded", () => {
  it("선점에 성공하면 운영진 채널에 보낸다", async () => {
    configured();
    postMessage.mockResolvedValue({ ok: true, ts: "1" });
    const { client, rpc } = fakeClient(claim());

    await notifyAllResponded(client, POLL.id);

    expect(rpc).toHaveBeenCalledWith("meeting_poll_claim_all_responded", { p_poll: POLL.id });
    expect(postMessage).toHaveBeenCalledOnce();
    expect(postMessage.mock.calls[0][0]).toMatchObject({ channel: "C_ADMIN", botToken: "xoxb-jarvis" });
  });

  it("아직 전원이 아니면(null) 아무것도 보내지 않는다", async () => {
    configured();
    const { client } = fakeClient(null);
    await notifyAllResponded(client, POLL.id);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("슬랙 설정이 없으면 선점조차 하지 않는다", async () => {
    // 먼저 선점하면 발송권만 태우고 알림은 영영 안 나간다
    const { client, rpc } = fakeClient(claim());
    await notifyAllResponded(client, POLL.id);
    expect(rpc).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("RPC가 실패해도 예외를 던지지 않는다", async () => {
    configured();
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(notifyAllResponded({ rpc } as unknown as SupabaseClient, POLL.id)).resolves.toBeUndefined();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("초대 링크 응답은 토큰 판 RPC를 쓴다", async () => {
    configured();
    postMessage.mockResolvedValue({ ok: true, ts: "1" });
    const { client, rpc } = fakeClient(claim());

    await notifyAllRespondedByToken(client, "tok-123");

    expect(rpc).toHaveBeenCalledWith("meeting_poll_claim_all_responded_by_token", { p_token: "tok-123" });
    expect(postMessage).toHaveBeenCalledOnce();
  });
});
