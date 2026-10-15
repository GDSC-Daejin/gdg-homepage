import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalSecret = process.env.POKEDEX_SLACK_SIGNING_SECRET;

function signedRequest() {
  const rawBody = `payload=${encodeURIComponent(JSON.stringify({ response_url: "https://example.com/response" }))}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const hmac = createHmac("sha256", "pokedex-secret");
  hmac.update(`v0:${timestamp}:${rawBody}`);
  return new Request("https://example.com/api/slack/pokedex/actions", {
    method: "POST",
    headers: { "x-slack-request-timestamp": timestamp, "x-slack-signature": `v0=${hmac.digest("hex")}` },
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

describe("도감봇 보유 확인 버튼", () => {
  it("출현 글의 보유 확인은 개인에게만 응답하고 같은 종의 포획만 조회한다", () => {
    const spawnRoute = readFileSync("src/app/api/cron/pokedex-spawn/route.ts", "utf8");
    const actionRoute = readFileSync("src/app/api/slack/pokedex/actions/route.ts", "utf8");

    expect(spawnRoute).toContain('text: "도감 확인"');
    expect(actionRoute).toContain('response_type: "ephemeral"');
    expect(actionRoute).toContain('.eq("pokemon_id", appearance.pokemon_id)');
    expect(actionRoute).toContain('.eq("outcome", "caught")');
  });

  it("유효하지 않은 Slack 요청을 거부한다", async () => {
    const { POST } = await import("@/app/api/slack/pokedex/actions/route");
    const request = signedRequest();
    request.headers.set("x-slack-signature", "v0=invalid");
    expect((await POST(request)).status).toBe(401);
  });
});
