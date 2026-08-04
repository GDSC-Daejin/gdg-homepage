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
    query.select.mockResolvedValue({ data: [{ id: "poll-1", title: "8월 정기 회의", is_mojisoop: true }], error: null });
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
      isMojisoop: true,
      slackUserIds: [],
    });
  });

  it("모지숲이 아닌 일정은 노션 없이 참여자 DM을 보낸다", async () => {
    const updateQuery = { eq: vi.fn(), is: vi.fn(), select: vi.fn() };
    updateQuery.eq.mockReturnValue(updateQuery);
    updateQuery.is.mockReturnValue(updateQuery);
    updateQuery.select.mockResolvedValue({ data: [{ id: "poll-1", title: "디자이너 작당모의", is_mojisoop: false }], error: null });
    const participantQuery = { select: vi.fn(), eq: vi.fn() };
    participantQuery.select.mockReturnValue(participantQuery);
    participantQuery.eq.mockResolvedValue({ data: [{ profiles: { slack_user_id: "U_LUMI" } }], error: null });
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => table === "meeting_polls"
        ? { update: vi.fn(() => updateQuery) }
        : participantQuery),
    });
    mocks.sendMeetingPollConfirmation.mockResolvedValue(undefined);

    const { confirmMeetingPoll } = await import("@/actions/meeting-poll");
    await confirmMeetingPoll("poll-1", "2026-08-04T10:30:00.000Z", 60);

    expect(mocks.createWeeklyPage).not.toHaveBeenCalled();
    expect(mocks.sendMeetingPollConfirmation).toHaveBeenCalledWith({
      id: "poll-1",
      title: "디자이너 작당모의",
      startIso: "2026-08-04T10:30:00.000Z",
      durationMin: 60,
      isMojisoop: false,
      slackUserIds: ["U_LUMI"],
    });
  });
});
