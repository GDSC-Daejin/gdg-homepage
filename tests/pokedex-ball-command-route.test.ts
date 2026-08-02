import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalSecret = process.env.POKEDEX_SLACK_SIGNING_SECRET;

function signedRequest(userId = "U1") {
  const rawBody = `command=%2F%EB%AA%AC%EC%8A%A4%ED%84%B0%EB%B3%BC&user_id=${userId}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const hmac = createHmac("sha256", "pokedex-secret");
  hmac.update(`v0:${timestamp}:${rawBody}`);
  return new Request("https://example.com/api/slack/pokedex/command", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": `v0=${hmac.digest("hex")}`,
    },
    body: rawBody,
  });
}

beforeEach(() => {
  process.env.POKEDEX_SLACK_SIGNING_SECRET = "pokedex-secret";
});
afterEach(() => {
  vi.resetModules();
  if (originalSecret === undefined) delete process.env.POKEDEX_SLACK_SIGNING_SECRET;
  else process.env.POKEDEX_SLACK_SIGNING_SECRET = originalSecret;
});

describe("도감봇 몬스터볼 명령", () => {
  it("유효하지 않은 Slack 요청을 거부한다", async () => {
    const module = await import("@/app/api/slack/pokedex/command/route").catch(() => null);
    expect(module).not.toBeNull();
    const request = signedRequest();
    request.headers.set("x-slack-signature", "v0=invalid");
    expect((await module?.POST(request))?.status).toBe(401);
  });
});
