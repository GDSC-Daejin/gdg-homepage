import { beforeEach, describe, expect, it, vi } from "vitest";

const cookies = vi.fn();
const headers = vi.fn();
const createClient = vi.fn();

vi.mock("next/headers", () => ({ cookies, headers }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

describe("getProfile", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    cookies.mockResolvedValue({ getAll: () => [{ name: "sb-project-auth-token" }] });
  });

  it("Proxy가 검증해 전달한 사용자 ID로 프로필을 조회한다", async () => {
    headers.mockResolvedValue({ get: () => "user-1" });
    const getClaims = vi.fn();
    const single = vi.fn().mockResolvedValue({ data: { id: "user-1", name: "옥지훈" } });
    const eq = vi.fn().mockReturnValue({ single });
    createClient.mockResolvedValue({
      auth: { getClaims },
      from: () => ({ select: () => ({ eq }) }),
    });

    const { getProfile } = await import("@/lib/auth");

    await expect(getProfile()).resolves.toMatchObject({ id: "user-1" });
    expect(getClaims).not.toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });
});
