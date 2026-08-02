import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addReaction, listUserEmails, postMessage, updateMessage } from "@/lib/slack/api";

const originalFetch = globalThis.fetch;

function mockFetch(payload: unknown) {
  const spy = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(payload), { status: 200 }),
  );
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

beforeEach(() => {
  process.env.SLACK_BOT_TOKEN = "xoxb-test";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("Slack Web API 클라이언트", () => {
  it("postMessage가 ts를 돌려준다", async () => {
    const spy = mockFetch({ ok: true, ts: "1784791636.251449" });
    const result = await postMessage({ channel: "C1", text: "안녕" });
    expect(result).toEqual({ ok: true, ts: "1784791636.251449" });
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe("https://slack.com/api/chat.postMessage");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer xoxb-test" });
    expect(JSON.parse(String(init?.body))).toEqual({ channel: "C1", text: "안녕" });
  });
  it("threadTs를 주면 thread_ts로 보낸다", async () => {
    const spy = mockFetch({ ok: true, ts: "2" });
    await postMessage({ channel: "C1", text: "답글", threadTs: "1" });
    const [, init] = spy.mock.calls[0];
    expect(JSON.parse(String(init?.body)).thread_ts).toBe("1");
  });
  it("HTTP 200이어도 ok:false면 실패로 처리한다", async () => {
    mockFetch({ ok: false, error: "channel_not_found" });
    expect(await postMessage({ channel: "C1", text: "안녕" })).toEqual({ ok: false, error: "channel_not_found" });
  });
  it("updateMessage가 chat.update를 호출한다", async () => {
    const spy = mockFetch({ ok: true, ts: "1" });
    expect(await updateMessage({ channel: "C1", ts: "1", text: "수정" })).toEqual({ ok: true, ts: "1" });
    expect(spy.mock.calls[0][0]).toBe("https://slack.com/api/chat.update");
  });
  it("addReaction이 콜론 없는 이름을 보낸다", async () => {
    const spy = mockFetch({ ok: true });
    await addReaction({ channel: "C1", ts: "1", emoji: "squirtle" });
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe("https://slack.com/api/reactions.add");
    expect(JSON.parse(String(init?.body)).name).toBe("squirtle");
  });
  it("addReaction에 토큰을 주면 해당 봇으로 반응을 추가한다", async () => {
    const spy = mockFetch({ ok: true });
    await addReaction({ channel: "C1", ts: "1", emoji: "pokeball", botToken: "xoxb-pokedex" });
    const [, init] = spy.mock.calls[0];
    expect(init?.headers).toMatchObject({ Authorization: "Bearer xoxb-pokedex" });
  });
  it("already_reacted는 성공으로 취급한다", async () => {
    mockFetch({ ok: false, error: "already_reacted" });
    expect((await addReaction({ channel: "C1", ts: "1", emoji: "squirtle" })).ok).toBe(true);
  });
  it("listUserEmails가 봇·삭제 사용자를 빼고 소문자 이메일로 모은다", async () => {
    mockFetch({ ok: true, members: [
      { id: "U1", is_bot: false, deleted: false, profile: { email: "A@Gmail.com" } },
      { id: "U2", is_bot: true, deleted: false, profile: { email: "bot@x.com" } },
      { id: "U3", is_bot: false, deleted: true, profile: { email: "gone@x.com" } },
      { id: "U4", is_bot: false, deleted: false, profile: {} },
    ], response_metadata: { next_cursor: "" } });
    const map = await listUserEmails();
    expect(map.get("U1")).toBe("a@gmail.com");
    expect(map.size).toBe(1);
  });
  it("토큰이 없으면 호출하지 않고 실패를 반환한다", async () => {
    delete process.env.SLACK_BOT_TOKEN;
    const spy = mockFetch({ ok: true, ts: "1" });
    expect(await postMessage({ channel: "C1", text: "안녕" })).toEqual({ ok: false, error: "missing_token" });
    expect(spy).not.toHaveBeenCalled();
  });
});
