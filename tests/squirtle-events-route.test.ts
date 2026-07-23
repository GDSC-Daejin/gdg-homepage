import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: (fn: () => unknown) => { void fn; } };
});

const SECRET = "test-signing-secret";

function signedRequest(body: unknown, secret = SECRET) {
  const raw = JSON.stringify(body);
  const ts = String(Math.floor(Date.now() / 1000));
  const hmac = createHmac("sha256", secret);
  hmac.update(`v0:${ts}:${raw}`);
  return new Request("https://example.com/api/slack/events", { method: "POST", headers: { "x-slack-request-timestamp": ts, "x-slack-signature": `v0=${hmac.digest("hex")}`, "content-type": "application/json" }, body: raw });
}

beforeEach(() => {
  process.env.SLACK_SIGNING_SECRET = SECRET;
  process.env.SLACK_BOT_USER_ID = "UBOT";
});
afterEach(() => vi.resetModules());

describe("이벤트 라우트", () => {
  it("url_verification에 challenge를 그대로 돌려준다", async () => {
    const { POST } = await import("@/app/api/slack/events/route");
    const res = await POST(signedRequest({ type: "url_verification", challenge: "abc123" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ challenge: "abc123" });
  });
  it("서명이 틀리면 401을 준다", async () => {
    const { POST } = await import("@/app/api/slack/events/route");
    expect((await POST(signedRequest({ type: "event_callback" }, "wrong-secret"))).status).toBe(401);
  });
  it("유효한 이벤트에 200을 즉시 준다", async () => {
    const { POST } = await import("@/app/api/slack/events/route");
    const res = await POST(signedRequest({ type: "event_callback", event: { type: "reaction_added", user: "U1", reaction: "squirtle", item: { ts: "1" } } }));
    expect(res.status).toBe(200);
  });
});

describe("shouldProcess", () => {
  const config = { emoji: "squirtle", botUserId: "UBOT" };
  it("설정된 이모지의 reaction_added를 처리한다", async () => {
    const { shouldProcess } = await import("@/app/api/slack/events/route");
    expect(shouldProcess({ type: "reaction_added", user: "U1", reaction: "squirtle", item: { ts: "1" } }, config)).toBe(true);
  });
  it("다른 이모지는 무시한다", async () => {
    const { shouldProcess } = await import("@/app/api/slack/events/route");
    expect(shouldProcess({ type: "reaction_added", user: "U1", reaction: "tada", item: { ts: "1" } }, config)).toBe(false);
  });
  it("reaction_added가 아니면 무시한다", async () => {
    const { shouldProcess } = await import("@/app/api/slack/events/route");
    expect(shouldProcess({ type: "reaction_removed", user: "U1", reaction: "squirtle", item: { ts: "1" } }, config)).toBe(false);
  });
  it("봇 자신의 리액션은 무시한다", async () => {
    const { shouldProcess } = await import("@/app/api/slack/events/route");
    expect(shouldProcess({ type: "reaction_added", user: "UBOT", reaction: "squirtle", item: { ts: "1" } }, config)).toBe(false);
  });
  it("item.ts가 없으면 무시한다", async () => {
    const { shouldProcess } = await import("@/app/api/slack/events/route");
    expect(shouldProcess({ type: "reaction_added", user: "U1", reaction: "squirtle", item: {} }, config)).toBe(false);
  });
});
