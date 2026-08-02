import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function request(auth?: string) {
  return new NextRequest("https://example.com/api/cron/pokedex-ranking", {
    headers: auth ? { authorization: auth } : {},
  });
}

beforeEach(() => {
  process.env.CRON_SECRET = "cron-secret";
});
afterEach(() => vi.resetModules());

describe("도감 보유 랭킹 크론", () => {
  it("CRON_SECRET 없거나 잘못된 요청을 거부한다", async () => {
    const module = await import("@/app/api/cron/pokedex-ranking/route").catch(() => null);
    expect(module).not.toBeNull();
    expect((await module?.GET(request("Bearer wrong")))?.status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await module?.GET(request("Bearer cron-secret")))?.status).toBe(401);
  });
});
