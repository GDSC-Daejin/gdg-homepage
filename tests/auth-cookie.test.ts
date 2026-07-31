import { describe, expect, it } from "vitest";
import { hasAuthCookie } from "@/lib/supabase/has-auth-cookie";

describe("hasAuthCookie", () => {
  it("Supabase 세션 쿠키와 분할 쿠키만 인증 쿠키로 인식한다", () => {
    expect(hasAuthCookie([{ name: "sb-project-auth-token" }])).toBe(true);
    expect(hasAuthCookie([{ name: "sb-project-auth-token.0" }])).toBe(true);
    expect(hasAuthCookie([{ name: "sb-project-auth-token-code-verifier" }])).toBe(false);
  });
});
