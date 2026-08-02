import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("NaverMap SDK 로더", () => {
  it("geocoder 서브모듈이 준비된 뒤에 주소 지오코딩을 시작한다", async () => {
    const source = await readFile("src/components/NaverMap.tsx", "utf8");

    expect(source).toMatch(/onJSContentLoaded\s*=\s*onReady/);
  });
});
