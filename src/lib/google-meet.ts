// 서버 전용: GOOGLE_MEET_*는 클라이언트 컴포넌트에서 import하지 말 것.
async function getAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_MEET_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_MEET_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_MEET_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("GOOGLE_MEET_ENV_MISSING");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error("GOOGLE_MEET_TOKEN_FAILED");

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("GOOGLE_MEET_TOKEN_FAILED");
  return json.access_token;
}

export async function createMeetSpace(): Promise<{
  meetingUri: string;
  meetingCode: string;
  name: string;
}> {
  const accessToken = await getAccessToken();
  const res = await fetch("https://meet.googleapis.com/v2/spaces", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error("GOOGLE_MEET_SPACE_FAILED");

  const json = (await res.json()) as {
    name?: string;
    meetingUri?: string;
    meetingCode?: string;
  };
  if (!json.name || !json.meetingUri || !json.meetingCode) {
    throw new Error("GOOGLE_MEET_SPACE_FAILED");
  }

  return {
    name: json.name,
    meetingUri: json.meetingUri,
    meetingCode: json.meetingCode,
  };
}
