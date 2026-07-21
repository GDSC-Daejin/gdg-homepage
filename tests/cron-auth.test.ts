import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { hasValidCronAuthorization } from "@/lib/cron";

describe("cron 인증", () => {
  it("정확한 Bearer 시크릿만 통과시킨다", () => {
    expect(hasValidCronAuthorization("Bearer correct-secret", "correct-secret")).toBe(true);
    expect(hasValidCronAuthorization("Bearer wrong-secret", "correct-secret")).toBe(false);
    expect(hasValidCronAuthorization(null, "correct-secret")).toBe(false);
  });

  it("두 cron 라우트가 상수시간 비교 헬퍼를 사용한다", async () => {
    const routes = await Promise.all([
      readFile("src/app/api/cron/attendance-warning/route.ts", "utf8"),
      readFile("src/app/api/cron/event-reminder/route.ts", "utf8"),
    ]);

    for (const route of routes) {
      expect(route).toContain("hasValidCronAuthorization");
      expect(route).not.toContain('get("authorization") !==');
    }
  });
});
