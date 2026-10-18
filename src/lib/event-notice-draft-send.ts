import { postMessage } from "@/lib/slack/api";
import {
  buildEventNoticeDraftMessage,
  type EventNoticeDraftInput,
} from "@/lib/event-notice-draft";

/**
 * 새 이벤트의 공지 초안을 admin 채널에 올린다. 실패해도 던지지 않고 사유 문장을 돌려준다.
 * 다른 운영진 알림처럼 Jarvis(SLACK_JARVIS_BOT_TOKEN)로 운영진 채널(SLACK_ADMIN_CHANNEL_ID)에 보낸다.
 */
export async function sendEventNoticeDraft(
  eventId: string,
  input: EventNoticeDraftInput,
): Promise<string | undefined> {
  const botToken = process.env.SLACK_JARVIS_BOT_TOKEN;
  const channel = process.env.SLACK_ADMIN_CHANNEL_ID;
  if (!botToken || !channel) return "슬랙 설정이 없어 공지 초안을 보내지 못했어요";

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  try {
    const posted = await postMessage({
      channel,
      botToken,
      text: buildEventNoticeDraftMessage(input, `${siteUrl}/admin/events/${eventId}`),
    });
    if (posted.ok) return undefined;
    console.error("[event-notice-draft] 슬랙 발송 실패", posted.error);
    return `공지 초안을 보내지 못했어요 (${posted.error})`;
  } catch (err) {
    console.error("[event-notice-draft] 슬랙 발송 오류", err);
    return "공지 초안을 보내지 못했어요";
  }
}
