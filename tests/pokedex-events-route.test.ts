import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalSecret = process.env.POKEDEX_SLACK_SIGNING_SECRET;

function signedRequest(payload: object) {
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const hmac = createHmac("sha256", "pokedex-secret");
  hmac.update(`v0:${timestamp}:${rawBody}`);
  return new Request("https://example.com/api/slack/pokedex/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
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
  if (originalSecret === undefined) delete process.env.POKEDEX_SLACK_SIGNING_SECRET;
  else process.env.POKEDEX_SLACK_SIGNING_SECRET = originalSecret;
});

describe("도감봇 이벤트 경로", () => {
  it("도감봇 서명으로 URL 검증을 통과시킨다", async () => {
    const { POST } = await import("@/app/api/slack/pokedex/events/route");
    const response = await POST(signedRequest({ type: "url_verification", challenge: "challenge" }));
    expect(await response.json()).toEqual({ challenge: "challenge" });
  });
  it("도감봇이 자기 출현 글에 단 반응은 무시한다", async () => {
    const { shouldProcess } = await import("@/app/api/slack/pokedex/events/route");
    expect(shouldProcess({ type: "reaction_added", user: "UBOT", item_user: "UBOT", reaction: "pokeball", item: { ts: "1" } })).toBe(false);
  });
});

describe("도감봇 이벤트 중복 방지", () => {
  it("같은 Slack 이벤트 ID는 한 번만 선점한다", async () => {
    const inserted = new Set<string>();
    const supabase = {
      from: vi.fn(() => ({
        insert: async ({ event_id }: { event_id: string }) => {
          if (inserted.has(event_id)) return { error: { code: "23505" } };
          inserted.add(event_id);
          return { error: null };
        },
      })),
    };
    const { claimSlackEvent } = await import("@/app/api/slack/pokedex/events/route");

    await expect(claimSlackEvent(supabase, "Ev123")).resolves.toBe(true);
    await expect(claimSlackEvent(supabase, "Ev123")).resolves.toBe(false);
    expect(supabase.from).toHaveBeenCalledWith("pokedex_slack_events");
  });
});
