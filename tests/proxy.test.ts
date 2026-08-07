import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims } }),
}));

import { proxy } from "@/proxy";

describe("proxy", () => {
  beforeEach(() => getClaims.mockResolvedValue({ data: { claims: { sub: "member-id" } } }));

  it("인증된 루트 요청을 대시보드로 내부 라우팅한다", async () => {
    const request = new NextRequest("https://gdg.example.com/", {
      headers: { cookie: "sb-project-auth-token=session" },
    });

    const response = await proxy(request);

    expect(response.headers.get("x-middleware-rewrite")).toBe("https://gdg.example.com/dashboard");
  });
});
