import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  nudgeParticipants: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/meeting-poll-nudge", () => ({ nudgeParticipants: mocks.nudgeParticipants }));

describe("회의 조율 마감 알림 크론", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("참가자 조회가 실패하면 알림 완료로 기록하지 않는다", async () => {
    const pollQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      gt: vi.fn(),
      lte: vi.fn(),
      update: vi.fn(),
    };
    pollQuery.select.mockReturnValue(pollQuery);
    pollQuery.eq.mockReturnValue(pollQuery);
    pollQuery.is.mockReturnValue(pollQuery);
    pollQuery.gt.mockReturnValue(pollQuery);
    pollQuery.lte.mockResolvedValue({ data: [{ id: "poll-1", title: "주간 회의" }], error: null });

    const participantQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      not: vi.fn(),
    };
    participantQuery.select.mockReturnValue(participantQuery);
    participantQuery.eq.mockReturnValue(participantQuery);
    participantQuery.is.mockReturnValue(participantQuery);
    participantQuery.not.mockResolvedValue({ data: null, error: { message: "database unavailable" } });

    const updateResult = { eq: vi.fn() };
    updateResult.eq.mockResolvedValue({ error: null });
    pollQuery.update.mockReturnValue(updateResult);
    mocks.createClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "meeting_polls") return pollQuery;
        if (table === "meeting_poll_participants") return participantQuery;
        return {};
      }),
    });

    const { GET } = await import("@/app/api/cron/meeting-poll-due/route");
    const response = await GET(
      new NextRequest("https://example.com/api/cron/meeting-poll-due", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: "database unavailable", sent: 0 });
    expect(pollQuery.update).not.toHaveBeenCalled();
    expect(mocks.nudgeParticipants).not.toHaveBeenCalled();
  });
});
