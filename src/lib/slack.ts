// 서버 전용: SLACK_WEBHOOK_URL은 서버 환경변수이므로 클라이언트 컴포넌트에서 import하지 말 것.
export async function postSlack(text: string): Promise<{ error?: string }> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    return { error: "슬랙 웹훅이 설정되지 않았어요 (SLACK_WEBHOOK_URL)" };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      return { error: "슬랙 메시지 전송에 실패했어요" };
    }

    return {};
  } catch {
    return { error: "슬랙 메시지 전송에 실패했어요" };
  }
}
