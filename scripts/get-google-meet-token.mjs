import http from "node:http";

const [argClientId, argClientSecret] = process.argv.slice(2);
const clientId = argClientId ?? process.env.GOOGLE_MEET_CLIENT_ID;
const clientSecret = argClientSecret ?? process.env.GOOGLE_MEET_CLIENT_SECRET;
const redirectUri = "http://localhost:53682";

if (!clientId || !clientSecret) {
  console.error("GOOGLE_MEET_CLIENT_ID와 GOOGLE_MEET_CLIENT_SECRET을 환경 변수 또는 인자로 입력해주세요.");
  process.exitCode = 1;
} else {
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/meetings.space.created https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
  }).toString();

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", redirectUri);
    const error = url.searchParams.get("error");
    const code = url.searchParams.get("code");

    if (error || !code) {
      response.end("Google 승인이 취소됐어요. 터미널에서 다시 시도해주세요.");
      console.error(error ?? "인증 코드를 받지 못했어요.");
      server.close();
      return;
    }

    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });
      const token = await tokenResponse.json();
      if (!tokenResponse.ok || !token.refresh_token) {
        throw new Error("refresh_token을 받지 못했어요. Google 계정의 기존 권한을 제거한 뒤 다시 시도해주세요.");
      }

      response.end("완료됐어요. 터미널에서 refresh token을 확인해주세요.");
      console.log("\nGOOGLE_MEET_REFRESH_TOKEN=");
      console.log(token.refresh_token);
      console.log("\n이 값을 .env에 저장해주세요.");
    } catch (cause) {
      response.end("토큰 교환에 실패했어요. 터미널 로그를 확인해주세요.");
      console.error(cause);
      process.exitCode = 1;
    } finally {
      server.close();
    }
  });

  server.listen(53682, "localhost", () => {
    console.log("아래 URL을 브라우저에서 열어 Google 계정을 승인해주세요:\n");
    console.log(authUrl.toString());
  });
}
