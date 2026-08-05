import { dateWithWeekday, durationLabel } from "@/lib/meeting-poll";
import { addReaction, openDirectMessage, postMessage } from "@/lib/slack/api";

const CONFIRMATION_EMOJI = "cb3dc3d2-fd74-4a3b-a9e1-f7ad58497090";

export async function sendMeetingPollCreated({
  id,
  title,
  dates,
  startHour,
  endHour,
  isMojisoop,
  isRegularSession,
}: {
  id: string;
  title: string;
  dates: string[];
  startHour: number;
  endHour: number;
  isMojisoop: boolean;
  isRegularSession: boolean;
}): Promise<string | undefined> {
  const botToken = process.env.SLACK_JARVIS_BOT_TOKEN;
  const channel = isRegularSession
    ? process.env.SLACK_NOTICE_CHANNEL_ID
    : isMojisoop ? process.env.SLACK_ADMIN_CHANNEL_ID : undefined;
  if (!botToken || !channel) return "생성 알림 채널이 설정되지 않아 알림을 보내지 못했어요";

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const period = dates.length
    ? `${dateWithWeekday(dates[0])} ~ ${dateWithWeekday(dates[dates.length - 1])}`
    : "후보일 미정";
  const posted = await postMessage({
    channel,
    botToken,
    text: `📢 [${isRegularSession ? "정기세션" : "모지숲"}] "${title}" 수요조사가 시작됐어요\n${period} · ${startHour}시~${endHour}시\n${siteUrl}/schedule/${id}`,
  });
  return posted.ok ? undefined : `수요조사 생성 알림은 실패했어요 (${posted.error})`;
}

export async function sendMeetingPollConfirmation({
  id,
  title,
  startIso,
  durationMin,
  isMojisoop = true,
  isRegularSession = false,
  slackUserIds = [],
}: {
  id: string;
  title: string;
  startIso: string;
  durationMin: number;
  isMojisoop?: boolean;
  isRegularSession?: boolean;
  slackUserIds?: string[];
}): Promise<string | undefined> {
  const botToken = process.env.SLACK_JARVIS_BOT_TOKEN;
  if (!botToken) {
    return "슬랙 설정이 없어 확정 알림을 보내지 못했어요";
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const when = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(startIso));
  if (isRegularSession) {
    const channel = process.env.SLACK_NOTICE_CHANNEL_ID;
    if (!channel) return "공지사항 채널이 설정되지 않아 확정 알림을 보내지 못했어요";
    const posted = await postMessage({
      channel,
      botToken,
      text: `📢 [정기세션] "${title}" 일정이 확정됐어요\n${when} · ${durationLabel(durationMin)}\n${siteUrl}/events`,
    });
    return posted.ok ? undefined : `정기세션 공지 알림은 실패했어요 (${posted.error})`;
  }

  if (!isMojisoop) {
    const recipients = [...new Set(slackUserIds)];
    if (recipients.length === 0) return "Slack이 연결된 참여자가 없어 확정 DM을 보내지 못했어요";
    const results = await Promise.all(recipients.map(async (user) => {
      const dm = await openDirectMessage({ user, botToken });
      if (!dm.ok) return false;
      const posted = await postMessage({
        channel: dm.channel,
        botToken,
        text: `[스케줄] "${title}" 일정이 확정됐어요. 확인해주세요.\n${when} · ${durationLabel(durationMin)}\n${siteUrl}/schedule/${id}`,
      });
      return posted.ok;
    }));
    const failed = results.filter((ok) => !ok).length;
    return failed ? `${failed}명에게 확정 DM을 보내지 못했어요` : undefined;
  }

  const channel = process.env.SLACK_ADMIN_CHANNEL_ID;
  if (!channel) return "슬랙 설정이 없어 확정 알림을 보내지 못했어요";
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
