import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("랜딩 초기 렌더링", () => {
  it("LCP 히어로를 등장 애니메이션으로 숨기지 않는다", async () => {
    const landing = await readFile("src/app/landing-preview/Landing.tsx", "utf8");

    expect(landing).not.toMatch(/className="[^"]*\bnb-in\b/);
  });

  it("분석 코드를 초기 클라이언트 번들에서 분리한다", async () => {
    const [layout, analytics] = await Promise.all([
      readFile("src/app/layout.tsx", "utf8"),
      readFile("src/components/analytics/DeferredAnalytics.tsx", "utf8"),
    ]);

    expect(layout).toContain('import { DeferredAnalytics } from "@/components/analytics/DeferredAnalytics"');
    expect(analytics).toContain('import dynamic from "next/dynamic"');
    expect(analytics).toContain("ssr: false");
  });

  it("첫 화면 밖 랜딩 섹션의 초기 렌더링을 미룬다", async () => {
    const styles = await readFile("src/app/landing-preview/landing-preview.css", "utf8");

    expect(styles).toContain("content-visibility: auto");
  });

  it("랜딩은 별도 웹폰트를 요청하지 않는다", async () => {
    const styles = await readFile("src/app/landing-preview/landing-preview.css", "utf8");

    expect(styles).toContain("font-family: -apple-system");
  });
});
