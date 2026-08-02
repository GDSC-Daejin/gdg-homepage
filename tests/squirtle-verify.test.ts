import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySlackSignature } from "@/lib/slack/verify";

const SECRET = "test-signing-secret";
const BODY = '{"type":"event_callback"}';

function sign(body: string, timestamp: string, secret = SECRET) {
  const hmac = createHmac("sha256", secret);
  hmac.update(`v0:${timestamp}:${body}`);
  return `v0=${hmac.digest("hex")}`;
}

const NOW = new Date("2026-07-23T10:00:00Z");
const TS = String(Math.floor(NOW.getTime() / 1000));

describe("Slack 서명 검증", () => {
  it("유효한 서명을 통과시킨다", () => {
    expect(verifySlackSignature({ rawBody: BODY, timestamp: TS, signature: sign(BODY, TS), signingSecret: SECRET, now: NOW })).toBe(true);
  });
  it("body가 변조되면 거부한다", () => {
    expect(verifySlackSignature({ rawBody: '{"type":"tampered"}', timestamp: TS, signature: sign(BODY, TS), signingSecret: SECRET, now: NOW })).toBe(false);
  });
  it("다른 시크릿으로 만든 서명을 거부한다", () => {
    expect(verifySlackSignature({ rawBody: BODY, timestamp: TS, signature: sign(BODY, TS, "wrong-secret"), signingSecret: SECRET, now: NOW })).toBe(false);
  });
  it("5분을 초과한 요청을 거부한다 (리플레이 방지)", () => {
    const old = String(Math.floor(NOW.getTime() / 1000) - 301);
    expect(verifySlackSignature({ rawBody: BODY, timestamp: old, signature: sign(BODY, old), signingSecret: SECRET, now: NOW })).toBe(false);
  });
  it("미래로 5분을 초과한 요청도 거부한다", () => {
    const future = String(Math.floor(NOW.getTime() / 1000) + 301);
    expect(verifySlackSignature({ rawBody: BODY, timestamp: future, signature: sign(BODY, future), signingSecret: SECRET, now: NOW })).toBe(false);
  });
  it("헤더가 없으면 거부한다", () => {
    expect(verifySlackSignature({ rawBody: BODY, timestamp: null, signature: null, signingSecret: SECRET, now: NOW })).toBe(false);
  });
  it("서명 형식이 잘못되면 거부한다", () => {
    expect(verifySlackSignature({ rawBody: BODY, timestamp: TS, signature: "garbage", signingSecret: SECRET, now: NOW })).toBe(false);
  });
  it("timestamp가 숫자가 아니면 거부한다", () => {
    expect(verifySlackSignature({ rawBody: BODY, timestamp: "not-a-number", signature: sign(BODY, TS), signingSecret: SECRET, now: NOW })).toBe(false);
  });
});
