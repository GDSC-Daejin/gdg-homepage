import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createWeeklyPage: vi.fn(),
  isDemoMode: vi.fn(),
  requireAdmin: vi.fn(),
  sendMeetingPollConfirmation: vi.fn(),
  sendMeetingPollCreated: vi.fn(),
  updatePoll: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/demo", () => ({ isDemoMode: mocks.isDemoMode }));
vi.mock("@/lib/notion", () => ({ createWeeklyPage: mocks.createWeeklyPage }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/meeting-poll-confirmation", () => ({
  sendMeetingPollConfirmation: mocks.sendMeetingPollConfirmation,
  sendMeetingPollCreated: mocks.sendMeetingPollCreated,
}));

describe("confirmMeetingPoll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isDemoMode.mockResolvedValue(false);
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
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
    mocks.updatePoll.mockReturnValue(query);
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => ({ update: mocks.updatePoll })) });
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

  it("정기세션 수요조사는 확정 시 정기세션 이벤트를 만든다", async () => {
    const updateQuery = { eq: vi.fn(), is: vi.fn(), select: vi.fn() };
    updateQuery.eq.mockReturnValue(updateQuery);
    updateQuery.is.mockReturnValue(updateQuery);
    updateQuery.select.mockResolvedValue({
      data: [{ id: "poll-1", title: "8월 정기세션", is_mojisoop: false, is_regular_session: true, event_id: null }],
      error: null,
    });
    const eventInsert = { select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "event-1" }, error: null }) }) };
    const insertEvent = vi.fn(() => eventInsert);
    const eventLink = { eq: vi.fn().mockResolvedValue({ error: null }) };
    const registerAvailable = vi.fn().mockResolvedValue({ error: null });
    const memberCountQuery = { in: vi.fn(), eq: vi.fn(), not: vi.fn() };
    memberCountQuery.in.mockReturnValue(memberCountQuery);
    memberCountQuery.eq.mockReturnValue(memberCountQuery);
    memberCountQuery.not.mockResolvedValue({ count: 14, error: null });
    const participantQuery = { select: vi.fn(), eq: vi.fn() };
    participantQuery.select.mockReturnValue(participantQuery);
    participantQuery.eq.mockResolvedValue({ data: [], error: null });
    let meetingUpdates = 0;
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "meeting_polls") {
          return { update: vi.fn(() => (++meetingUpdates === 1 ? updateQuery : eventLink)) };
        }
        if (table === "meeting_poll_participants") return participantQuery;
        if (table === "profiles") return { select: vi.fn(() => memberCountQuery) };
        return { insert: insertEvent };
      }),
      rpc: registerAvailable,
    });
    mocks.sendMeetingPollConfirmation.mockResolvedValue(undefined);

    const { confirmMeetingPoll } = await import("@/actions/meeting-poll");
    await confirmMeetingPoll("poll-1", "2026-08-04T10:30:00.000Z", 60);

    expect(eventInsert.select).toHaveBeenCalledWith("id");
    expect(insertEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: "session",
      title: "8월 4일 정기세션",
      starts_at: "2026-08-04T10:30:00.000Z",
      ends_at: "2026-08-04T11:30:00.000Z",
      event_date: "2026-08-04",
      start_time: "19:30",
      end_time: "20:30",
      capacity: 14,
      created_by: "admin-1",
    }));
    expect(eventLink.eq).toHaveBeenCalledWith("id", "poll-1");
    expect(registerAvailable).toHaveBeenCalledWith("register_available_poll_participants", {
      p_poll_id: "poll-1",
      p_event_id: "event-1",
    });
    expect(mocks.sendMeetingPollConfirmation).toHaveBeenCalledWith(expect.objectContaining({
      isRegularSession: true,
    }));
  });

  it("이미 연결된 정기세션 이벤트도 확정 시간으로 갱신한다", async () => {
    const pollQuery = { eq: vi.fn(), is: vi.fn(), select: vi.fn() };
    pollQuery.eq.mockReturnValue(pollQuery);
    pollQuery.is.mockReturnValue(pollQuery);
    pollQuery.select.mockResolvedValue({
      data: [{ id: "poll-1", title: "8월 정기세션", is_mojisoop: false, is_regular_session: true, event_id: "event-1" }],
      error: null,
    });
    const eventQuery = { eq: vi.fn().mockResolvedValue({ error: null }) };
    const updateEvent = vi.fn(() => eventQuery);
    const participantQuery = { select: vi.fn(), eq: vi.fn() };
    participantQuery.select.mockReturnValue(participantQuery);
    participantQuery.eq.mockResolvedValue({ data: [], error: null });
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "meeting_polls") return { update: vi.fn(() => pollQuery) };
        if (table === "meeting_poll_participants") return participantQuery;
        return { update: updateEvent };
      }),
    });
    mocks.sendMeetingPollConfirmation.mockResolvedValue(undefined);

    const { confirmMeetingPoll } = await import("@/actions/meeting-poll");
    await confirmMeetingPoll("poll-1", "2026-08-04T10:30:00.000Z", 60);

    expect(updateEvent).toHaveBeenCalledWith({
      starts_at: "2026-08-04T10:30:00.000Z",
      ends_at: "2026-08-04T11:30:00.000Z",
      event_date: "2026-08-04",
      start_time: "19:30",
      end_time: "20:30",
    });
    expect(eventQuery.eq).toHaveBeenCalledWith("id", "event-1");
  });
});

describe("closeMeetingPoll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isDemoMode.mockResolvedValue(false);
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
    const query = { eq: vi.fn(), is: vi.fn(), select: vi.fn() };
    query.eq.mockReturnValue(query);
    query.is.mockReturnValue(query);
    query.select.mockResolvedValue({ data: [{ id: "poll-1" }], error: null });
    mocks.updatePoll.mockReturnValue(query);
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => ({ update: mocks.updatePoll })) });
  });

  it("확정하지 않고 현재 시각으로 응답을 마감한다", async () => {
    const { closeMeetingPoll } = await import("@/actions/meeting-poll");

    await expect(closeMeetingPoll("poll-1")).resolves.toEqual({});
    expect(mocks.updatePoll).toHaveBeenCalledWith(expect.objectContaining({ due_at: expect.any(String) }));
  });
});

describe("applyBackupMeetingPoll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isDemoMode.mockResolvedValue(false);
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
  });

  it("백업 시간으로 확정 일정과 연결된 정기세션 이벤트를 함께 바꾼다", async () => {
    const pollQuery = { eq: vi.fn(), not: vi.fn(), select: vi.fn() };
    pollQuery.eq.mockReturnValue(pollQuery);
    pollQuery.not.mockReturnValue(pollQuery);
    pollQuery.select.mockResolvedValue({
      data: [{ id: "poll-1", is_regular_session: true, event_id: "event-1" }],
      error: null,
    });
    const eventQuery = { eq: vi.fn().mockResolvedValue({ error: null }) };
    const updateEvent = vi.fn(() => eventQuery);
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => table === "meeting_polls"
        ? { update: vi.fn(() => pollQuery) }
        : { update: updateEvent }),
    });

    const { applyBackupMeetingPoll } = await import("@/actions/meeting-poll");
    await expect(
      applyBackupMeetingPoll("poll-1", "2026-08-05T10:30:00.000Z", 60),
    ).resolves.toEqual({});

    expect(updateEvent).toHaveBeenCalledWith(expect.objectContaining({
      starts_at: "2026-08-05T10:30:00.000Z",
      ends_at: "2026-08-05T11:30:00.000Z",
    }));
    expect(eventQuery.eq).toHaveBeenCalledWith("id", "event-1");
  });
});
