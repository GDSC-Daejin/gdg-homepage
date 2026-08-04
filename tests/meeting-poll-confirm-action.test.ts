import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createWeeklyPage: vi.fn(),
  isDemoMode: vi.fn(),
  requireAdmin: vi.fn(),
  sendMeetingPollConfirmation: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/demo", () => ({ isDemoMode: mocks.isDemoMode }));
vi.mock("@/lib/notion", () => ({ createWeeklyPage: mocks.createWeeklyPage }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/meeting-poll-confirmation", () => ({
  sendMeetingPollConfirmation: mocks.sendMeetingPollConfirmation,
}));

describe("confirmMeetingPoll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isDemoMode.mockResolvedValue(false);
    mocks.createWeeklyPage.mockResolvedValue({ title: "8월 첫째 주", error: undefined });
    mocks.sendMeetingPollConfirmation.mockResolvedValue("슬랙 이모지 반응 실패");

    const query = {
      eq: vi.fn(),
      is: vi.fn(),
      select: vi.fn(),
    };
    query.eq.mockReturnValue(query);
    query.is.mockReturnValue(query);
    query.select.mockResolvedValue({ data: [{ id: "poll-1", title: "8월 정기 회의" }], error: null });
    mocks.createClient.mockResolvedValue({
      from: vi.fn(() => ({ update: vi.fn(() => query) })),
    });
  });

  it("확정 뒤 자비스 알림 실패를 경고로 돌리고 확정은 유지한다", async () => {
    const { confirmMeetingPoll } = await import("@/actions/meeting-poll");

    await expect(
      confirmMeetingPoll("poll-1", "2026-08-04T10:30:00.000Z", 60),
    ).resolves.toEqual({ warning: "노션에 \"8월 첫째 주\" 페이지를 만들었어요 · 슬랙 이모지 반응 실패" });
    expect(mocks.sendMeetingPollConfirmation).toHaveBeenCalledWith({
      id: "poll-1",
      title: "8월 정기 회의",
      startIso: "2026-08-04T10:30:00.000Z",
      durationMin: 60,
    });
  });
});
