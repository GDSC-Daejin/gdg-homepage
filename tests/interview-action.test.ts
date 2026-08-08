import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { bookSlot } from "@/actions/interview";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/demo", () => ({ isDemoMode: vi.fn().mockResolvedValue(false) }));

describe("bookSlot", () => {
  const oldEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...oldEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    };
    delete process.env.GOOGLE_MEET_CLIENT_ID;
    delete process.env.GOOGLE_MEET_CLIENT_SECRET;
    delete process.env.GOOGLE_MEET_REFRESH_TOKEN;
    vi.mocked(createServerClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: "slot-id", error: null }),
    } as never);
    vi.mocked(createServiceClient).mockReturnValue({} as never);
  });

  afterEach(() => {
    process.env = oldEnv;
    vi.restoreAllMocks();
  });

  it("Meet 환경변수가 없어도 예약 claim은 유지한다", async () => {
    await expect(bookSlot("token", "slot-id")).resolves.toEqual({
      warning: "면접 예약은 확정됐지만 Meet 링크를 자동 생성하지 못했어요",
    });
  });
});
