// 서버 전용: RESEND_API_KEY는 서버 환경변수이므로 클라이언트 컴포넌트에서 import하지 말 것.
function buildSubject(season: string): string {
  return `[GDG DJU] ${season} 리크루팅 결과 안내`;
}

function buildHtml(name: string, accepted: boolean): string {
  const body = accepted
    ? `<p>${name}님, GDG DJU 리크루팅에 합격하셨어요! 축하드려요.</p><p>오리엔테이션 등 추후 안내는 별도로 연락드릴게요.</p>`
    : `<p>${name}님, GDG DJU 리크루팅에 지원해주셔서 감사해요.</p><p>아쉽게도 이번에는 함께하지 못하게 됐어요. 다음 시즌에도 재지원을 환영해요.</p>`;

  return `<div style="font-family: sans-serif; line-height: 1.6;">${body}</div>`;
}

export async function sendResultEmail(params: {
  to: string;
  name: string;
  season: string;
  accepted: boolean;
}): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { sent: false, skipped: true };
  }

  const from = process.env.RESEND_FROM ?? "GDG DJU <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: buildSubject(params.season),
        html: buildHtml(params.name, params.accepted),
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return { sent: false, error: "결과 이메일 전송에 실패했어요" };
    }

    return { sent: true };
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return { sent: false, error: "결과 이메일 응답이 시간 초과됐어요" };
    }
    return { sent: false, error: "결과 이메일 전송에 실패했어요" };
  }
}
