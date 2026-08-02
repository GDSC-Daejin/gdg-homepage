import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function request(auth?: string) {
  return new NextRequest("https://example.com/api/cron/pokedex-ranking-daily", { headers: auth ? { authorization: auth } : {} });
}

beforeEach(() => {
  process.env.CRON_SECRET = "cron-secret";
});
afterEach(() => vi.resetModules());

describe("도감 랭킹전 일일 크론", () => {
  it("인증되지 않은 요청을 거부한다", async () => {
    const module = await import("@/app/api/cron/pokedex-ranking-daily/route").catch(() => null);
    expect(module).not.toBeNull();
    expect((await module?.GET(request("Bearer wrong")))?.status).toBe(401);
  });

  it("KST 06:00에 맞는 UTC 일일 일정을 등록한다", async () => {
    const vercel = await readFile("vercel.json", "utf8");
    expect(vercel).toContain('"path": "/api/cron/pokedex-ranking-daily"');
    expect(vercel).toContain('"schedule": "0 21 * * *"');
  });
});
