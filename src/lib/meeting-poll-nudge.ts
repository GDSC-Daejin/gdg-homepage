import type { SupabaseClient } from "@supabase/supabase-js";
import { openDirectMessage, postMessage } from "@/lib/slack/api";

/**
 * 아직 응답 안 한 사람에게 Slack 응답 요청을 보낸다.
 *
 * 어드민의 "알림 보내기" 버튼과 마감 전날 크론이 함께 쓴다 — 두 경로가 같은 함수를 지나야
 * 모지숲 일정은 운영진 채널 멘션, 그 외 일정은 참여자 DM으로 보낸다.
 *
 * 실패하면 사람이 읽을 문장, 성공하거나 보낼 사람이 없으면 undefined.
 * 인앱 알림은 이미 나간 뒤라 여기서 예외를 던지지 않는다.
 */
export async function nudgeAdminChannel(
  client: SupabaseClient,
  poll: { id: string; title: string; is_mojisoop: boolean },
  note?: string,
): Promise<string | undefined> {
  const { data } = await client
    .from("meeting_poll_participants")
    .select("name, profiles(slack_user_id)")
    .eq("poll_id", poll.id)
    .is("responded_at", null);

  // profiles는 user_id FK를 타고 오는 1:1이라 배열이 아니라 객체다(RegistrantsTable과 같은 형태).
  const pending = (data ?? []) as unknown as {
    name: string;
    profiles: { slack_user_id: string | null } | null;
  }[];
  if (pending.length === 0) return undefined;

  const botToken = process.env.SLACK_JARVIS_BOT_TOKEN;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  if (!botToken) return "앱 알림은 보냈어요. Jarvis 설정이 없어 슬랙 알림은 못 보냈어요";

  if (!poll.is_mojisoop) {
    const results = await Promise.all(
      pending.map(async (participant) => {
        const user = participant.profiles?.slack_user_id;
        if (!user) return participant.name;
        const dm = await openDirectMessage({ user, botToken });
        if (!dm.ok) return participant.name;
        const result = await postMessage({
          channel: dm.channel,
          botToken,
          text: `[스케줄] "${poll.title}" 응답을 부탁드려요.\n${siteUrl}/schedule/${poll.id}`,
        });
        return result.ok ? null : participant.name;
      }),
    );
    const failed = results.filter(Boolean);
    return failed.length ? `앱 알림은 보냈어요. DM을 못 보낸 참여자: ${failed.join(", ")}` : undefined;
  }

  const channel = process.env.SLACK_ADMIN_CHANNEL_ID;
  if (!channel) return "앱 알림은 보냈어요. 슬랙 설정이 없어 채널 멘션은 못 보냈어요";
  const mentions = pending
    .map((p) => (p.profiles?.slack_user_id ? `<@${p.profiles.slack_user_id}>` : p.name))
    .join(" ");
  const head = `[스케줄] "${poll.title}" 아직 응답 안 한 ${pending.length}명${note ? ` · ${note}` : ""}`;
  const result = await postMessage({
    channel,
    botToken,
    text: `${head}\n${mentions}\n${siteUrl}/schedule/${poll.id}`,
  });

  return result.ok ? undefined : `앱 알림은 보냈어요. 슬랙 멘션은 실패했어요 (${result.error})`;
}
