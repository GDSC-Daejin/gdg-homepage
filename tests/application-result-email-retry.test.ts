import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { sendResultEmail } from "@/lib/email";
import { resendApplicationResultEmail } from "@/actions/application";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-id" }),
  getProfile: vi.fn(),
}));
vi.mock("@/lib/demo", () => ({ isDemoMode: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendResultEmail: vi.fn() }));
vi.mock("@/lib/application-invite", () => ({
  applicationInviteUrl: vi.fn((token: string) => `https://example.com/onboarding?token=${token}`),
  createApplicationInviteToken: vi.fn(() => "raw-token"),
  hashApplicationInviteToken: vi.fn(() => "token-hash"),
}));

describe("resendApplicationResultEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
  });

  it("합격 결과 이메일 실패를 재발송하고 재시도 기록을 남긴다", async () => {
    const application = {
      applicant_name: "홍길동",
      email: "applicant@example.com",
      season: "2026-2",
      status: "accepted",
      applicant_id: null,
    };
    const single = vi.fn().mockResolvedValue({ data: application, error: null });
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single })) })),
      })),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    vi.mocked(sendResultEmail).mockResolvedValue({ sent: true });

    await expect(resendApplicationResultEmail("application-id")).resolves.toEqual({});

    expect(supabase.rpc).toHaveBeenNthCalledWith(
      1,
      "admin_issue_application_onboarding_invite",
      expect.objectContaining({ p_application: "application-id" }),
    );
    expect(sendResultEmail).toHaveBeenCalledWith({
      to: "applicant@example.com",
      name: "홍길동",
      season: "2026-2",
      accepted: true,
      onboardingUrl: "https://example.com/onboarding?token=raw-token",
    });
    expect(supabase.rpc).toHaveBeenNthCalledWith(
      2,
      "admin_log_result_email",
      expect.objectContaining({
        p_application: "application-id",
        p_detail: expect.objectContaining({ retry: true, sent: true }),
      }),
    );
  });
});
