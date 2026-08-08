import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncInterviewCalendarEvent } from "@/lib/google-calendar";

describe("syncInterviewCalendarEvent", () => {
  const OLD = process.env;

  beforeEach(() => {
    process.env = {
      ...OLD,
      GOOGLE_MEET_CLIENT_ID: "cid",
      GOOGLE_MEET_CLIENT_SECRET: "secret",
      GOOGLE_MEET_REFRESH_TOKEN: "rtoken",
      GOOGLE_CALENDAR_ID: "interviews@example.com",
    };
  });

  afterEach(() => {
    process.env = OLD;
    vi.restoreAllMocks();
  });

  it("예약 시간과 Meet 링크를 Calendar 이벤트 및 참석자 초대로 생성한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "atoken" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "gdgdjuabc" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      syncInterviewCalendarEvent({
        slotId: "abc-def",
        calendarEventId: null,
        season: "2026-2",
        startsAt: "2026-08-10T01:00:00.000Z",
        durationMin: 30,
        applicantName: "홍길동",
        meetUri: "https://meet.google.com/abc-defg-hij",
        attendeeEmails: ["applicant@example.com", "interviewer@example.com"],
      }),
    ).resolves.toEqual({ eventId: "gdgdjuabc" });

    expect(fetchMock.mock.calls[1][0]).toContain("calendar/v3/calendars/interviews%40example.com/events?sendUpdates=all");
    const request = fetchMock.mock.calls[1][1] as RequestInit;
    expect(request.method).toBe("POST");
    expect(JSON.parse(String(request.body))).toMatchObject({
      location: "https://meet.google.com/abc-defg-hij",
      start: { dateTime: "2026-08-10T01:00:00.000Z", timeZone: "Asia/Seoul" },
      end: { dateTime: "2026-08-10T01:30:00.000Z", timeZone: "Asia/Seoul" },
      attendees: [{ email: "applicant@example.com" }, { email: "interviewer@example.com" }],
    });
  });

  it("저장된 이벤트가 삭제됐으면 같은 ID로 다시 생성한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "atoken" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "gdgdjuabc" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await syncInterviewCalendarEvent({
      slotId: "abc",
      calendarEventId: "gdgdjuabc",
      season: "2026-2",
      startsAt: "2026-08-10T01:00:00.000Z",
      durationMin: 30,
      applicantName: "홍길동",
      meetUri: "https://meet.google.com/abc-defg-hij",
      attendeeEmails: ["applicant@example.com"],
    });

    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("PATCH");
    expect((fetchMock.mock.calls[2][1] as RequestInit).method).toBe("POST");
  });
});
