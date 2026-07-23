import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

function request(auth?: string) {
  return new NextRequest("https://example.com/api/cron/squirtle-daily", { headers: auth ? { authorization: auth } : {} });
}

beforeEach(() => {
  process.env.CRON_SECRET = "cron-secret";
});
afterEach(() => vi.resetModules());

describe("일일 크론 라우트", () => {
  it("CRON_SECRET이 없으면 401", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/cron/squirtle-daily/route");
    expect((await GET(request("Bearer cron-secret"))).status).toBe(401);
  });
  it("Authorization 헤더가 없으면 401", async () => {
    const { GET } = await import("@/app/api/cron/squirtle-daily/route");
    expect((await GET(request())).status).toBe(401);
  });
  it("잘못된 시크릿이면 401", async () => {
    const { GET } = await import("@/app/api/cron/squirtle-daily/route");
    expect((await GET(request("Bearer wrong"))).status).toBe(401);
  });
  it("Supabase 설정이 없으면 500", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { GET } = await import("@/app/api/cron/squirtle-daily/route");
    expect((await GET(request("Bearer cron-secret"))).status).toBe(500);
  });
});

describe("pickMessageIndex", () => {
  it("문구 개수 범위 안의 정수를 돌려준다", async () => {
    const { pickMessageIndex } = await import("@/app/api/cron/squirtle-daily/route");
    const { DAILY_MESSAGES } = await import("@/lib/squirtle/messages");
    for (let i = 0; i < 50; i += 1) {
      const index = pickMessageIndex();
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(DAILY_MESSAGES.length);
    }
  });
});
