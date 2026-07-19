import { afterEach, describe, expect, it, vi } from "vitest";
import { EVENTS, trackEvent } from "@/lib/analytics";

describe("trackEvent", () => {
  afterEach(() => {
    // @ts-expect-error - 테스트 정리
    delete globalThis.window;
  });

  it("window.gtag이 없으면 조용히 무시한다 (throw 안 함)", () => {
    // @ts-expect-error - node 환경엔 window 없음
    globalThis.window = {};
    expect(() => trackEvent("apply_submit")).not.toThrow();
  });

  it("window.gtag이 있으면 event 이름과 params로 호출한다", () => {
    const gtag = vi.fn();
    // @ts-expect-error - 테스트용 window 주입
    globalThis.window = { gtag };
    trackEvent(EVENTS.applySubmit, { position: "frontend" });
    expect(gtag).toHaveBeenCalledWith("event", "apply_submit", {
      position: "frontend",
    });
  });

  it("window 자체가 없어도 (SSR) throw 안 함", () => {
    expect(() => trackEvent("login")).not.toThrow();
  });
});
