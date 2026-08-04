// 서버 전용: RESEND_API_KEY는 서버 환경변수이므로 클라이언트 컴포넌트에서 import하지 말 것.
function buildSubject(season: string): string {
  return `[GDGOC DJU] ${season} 리크루팅 결과 안내`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHtml(name: string, accepted: boolean): string {
  const safeName = escapeHtml(name);
  const body = accepted
    ? `<p>${safeName}님, GDGOC DJU 리크루팅에 합격하셨어요! 축하드려요.</p><p>오리엔테이션 등 추후 안내는 별도로 연락드릴게요.</p>`
    : `<p>${safeName}님, GDGOC DJU 리크루팅에 지원해주셔서 감사해요.</p><p>아쉽게도 이번에는 함께하지 못하게 됐어요. 다음 시즌에도 재지원을 환영해요.</p>`;

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

  const from = process.env.RESEND_FROM ?? "GDGOC DJU <onboarding@resend.dev>";

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

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, skipped: true };

  const from = process.env.RESEND_FROM ?? "GDGOC DJU <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { sent: false, error: "이메일 전송에 실패했어요" };
    return { sent: true };
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return { sent: false, error: "이메일 응답이 시간 초과됐어요" };
    }
    return { sent: false, error: "이메일 전송에 실패했어요" };
  }
}

export async function sendInterviewInviteEmail(params: {
  to: string;
  name: string;
  season: string;
  bookingUrl: string;
}) {
  const html = `<div style="font-family: sans-serif; line-height: 1.6;">
    <p>${escapeHtml(params.name)}님, GDGOC DJU ${escapeHtml(params.season)} 서류 전형에 통과하셨어요. 축하드려요!</p>
    <p>아래 링크에서 면접 시간을 선택해주세요.</p>
    <p><a href="${escapeHtml(params.bookingUrl)}">면접 시간 예약하기</a></p>
  </div>`;
  return sendEmail(params.to, `[GDGOC DJU] ${params.season} 면접 일정 예약 안내`, html);
}

export async function sendInterviewConfirmEmail(params: {
  to: string;
  name: string;
  startsAt: string;
  meetUri: string;
}) {
  const when = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(params.startsAt));
  const safeMeetUri = escapeHtml(params.meetUri);
  const html = `<div style="font-family: sans-serif; line-height: 1.6;">
    <p>${escapeHtml(params.name)}님, 면접 예약이 확정됐어요.</p>
    <p><b>일시:</b> ${escapeHtml(when)} (KST)</p>
    <p><b>Google Meet:</b> <a href="${safeMeetUri}">${safeMeetUri}</a></p>
  </div>`;
  return sendEmail(params.to, "[GDGOC DJU] 면접 예약이 확정됐어요", html);
}
