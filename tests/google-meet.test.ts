import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMeetSpace } from "@/lib/google-meet";

describe("createMeetSpace", () => {
  const OLD = process.env;

  beforeEach(() => {
    process.env = {
      ...OLD,
      GOOGLE_MEET_CLIENT_ID: "cid",
      GOOGLE_MEET_CLIENT_SECRET: "secret",
      GOOGLE_MEET_REFRESH_TOKEN: "rtoken",
    };
  });

  afterEach(() => {
    process.env = OLD;
    vi.restoreAllMocks();
  });

  it("refresh token으로 access token 교환 후 space 생성", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "atoken" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            name: "spaces/abc",
            meetingUri: "https://meet.google.com/xyz-abcd-efg",
            meetingCode: "xyz-abcd-efg",
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const res = await createMeetSpace();

    expect(res.meetingUri).toBe("https://meet.google.com/xyz-abcd-efg");
    expect(res.meetingCode).toBe("xyz-abcd-efg");
    expect(fetchMock.mock.calls[0][0]).toContain("oauth2.googleapis.com/token");
    expect(fetchMock.mock.calls[1][0]).toContain("meet.googleapis.com/v2/spaces");
    const authHeader = (fetchMock.mock.calls[1][1] as RequestInit)
      .headers as Record<string, string>;
    expect(authHeader.Authorization).toBe("Bearer atoken");
  });

  it("env 없으면 throw", async () => {
    delete process.env.GOOGLE_MEET_REFRESH_TOKEN;
    await expect(createMeetSpace()).rejects.toThrow("GOOGLE_MEET_ENV_MISSING");
  });
});
