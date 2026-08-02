import type { SupabaseClient } from "@supabase/supabase-js";
import { postMessage } from "@/lib/slack/api";

/**
 * 아직 응답 안 한 사람을 운영진 슬랙 채널에 멘션한다.
 *
 * 어드민의 "알림 보내기" 버튼과 마감 전날 크론이 함께 쓴다 — 두 경로가 같은 함수를 지나야
 * 채널·봇·문구가 갈라지지 않는다. 운영진 알림은 Jarvis 이름으로 나간다(출석 경고와 같은 규칙).
 * 슬랙이 연결된 사람은 <@id>로, 아닌 사람과 이름만 초대된 게스트는 이름 그대로 적는다 —
 * 인앱 알림은 회원만 받을 수 있어 게스트가 조용히 빠지기 때문이다.
 *
 * 실패하면 사람이 읽을 문장, 성공하거나 보낼 사람이 없으면 undefined.
 * 인앱 알림은 이미 나간 뒤라 여기서 예외를 던지지 않는다.
 */
export async function nudgeAdminChannel(
  client: SupabaseClient,
  poll: { id: string; title: string },
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

  const channel = process.env.SLACK_ADMIN_CHANNEL_ID;
  const botToken = process.env.SLACK_JARVIS_BOT_TOKEN;
  if (!channel || !botToken) {
    return "앱 알림은 보냈어요. 슬랙 설정이 없어 채널 멘션은 못 보냈어요";
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
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
