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

  it("둘러보기에서는 포켓몬 주소를 관리자 더미 화면으로 돌린다", async () => {
    const request = new NextRequest("https://gdg.example.com/tour/admin/pokedex");

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://gdg.example.com/tour/admin");
  });

  it.each(["analytics", "dev"])("둘러보기의 %s 화면을 더미 데이터로 연다", async (segment) => {
    const request = new NextRequest(`https://gdg.example.com/tour/admin/${segment}`);

    const response = await proxy(request);

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      `https://gdg.example.com/admin/${segment}`,
    );
  });

  it("둘러보기의 쓰기 요청은 프록시에서 막는다", async () => {
    const request = new NextRequest("https://gdg.example.com/tour/admin/events", {
      method: "POST",
    });

    await expect(proxy(request)).resolves.toMatchObject({ status: 403 });
  });

  it("일반 경로에서는 전달된 데모 헤더를 제거한다", async () => {
    const request = new NextRequest("https://gdg.example.com/admin", {
      headers: { "x-gdg-demo-mode": "1" },
    });

    const response = await proxy(request);

    expect(response.headers.get("x-middleware-request-x-gdg-demo-mode")).toBeNull();
  });

  it("둘러보기 랜딩은 허용한다", async () => {
    const request = new NextRequest("https://gdg.example.com/tour/landing");

    await expect(proxy(request)).resolves.toMatchObject({ status: 200 });
  });

  it("둘러보기에서 누른 일반 링크는 둘러보기 주소로 돌린다", async () => {
    const request = new NextRequest("https://gdg.example.com/admin/events", {
      headers: { referer: "https://gdg.example.com/tour/admin" },
    });

    const response = await proxy(request);

    expect(response.headers.get("location")).toBe("https://gdg.example.com/tour/admin/events");
  });
});
