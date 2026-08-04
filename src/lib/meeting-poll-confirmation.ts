import { durationLabel } from "@/lib/meeting-poll";
import { addReaction, postMessage } from "@/lib/slack/api";

const CONFIRMATION_EMOJI = "cb3dc3d2-fd74-4a3b-a9e1-f7ad58497090";

export async function sendMeetingPollConfirmation({
  id,
  title,
  startIso,
  durationMin,
}: {
  id: string;
  title: string;
  startIso: string;
  durationMin: number;
}): Promise<string | undefined> {
  const channel = process.env.SLACK_ADMIN_CHANNEL_ID;
  const botToken = process.env.SLACK_JARVIS_BOT_TOKEN;
  if (!channel || !botToken) {
    return "슬랙 설정이 없어 확정 알림을 보내지 못했어요";
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const when = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(startIso));
  const posted = await postMessage({
    channel,
    botToken,
    text: `<!channel> [스케줄] "${title}" 일정이 확정됐어요\n${when} · ${durationLabel(durationMin)}\n:cb3dc3d2-fd74-4a3b-a9e1-f7ad58497090: 이모지로 확인해주세요\n${siteUrl}/schedule/${id}`,
  });
  if (!posted.ok) return `슬랙 확정 알림은 실패했어요 (${posted.error})`;

  const reacted = await addReaction({ channel, ts: posted.ts, emoji: CONFIRMATION_EMOJI, botToken });
  return reacted.ok
    ? undefined
    : `슬랙 알림은 보냈지만 확인 이모지 반응은 실패했어요 (${reacted.error ?? "unknown_error"})`;
}
