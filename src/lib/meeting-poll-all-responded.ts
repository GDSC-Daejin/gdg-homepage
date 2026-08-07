import type { SupabaseClient } from "@supabase/supabase-js";
import { dayKeyKst, timeKeyKst } from "@/lib/format";
import {
  MIN_BLOCK_MIN,
  REGULAR_SESSION_MIN_BLOCK_MIN,
  dateWithWeekday,
  durationLabel,
  normalizeSlots,
  pollTimes,
  recommendBlocks,
  timeAmPm,
  type ParticipantView,
} from "@/lib/meeting-poll";
import { postMessage } from "@/lib/slack/api";

const MEDALS = ["🥇", "🥈", "🥉"] as const;

/** meeting_poll_claim_all_responded가 선점에 성공했을 때 돌려주는 것 */
export interface AllRespondedClaim {
  poll: {
    id: string;
    title: string;
    dates: string[];
    start_hour: number;
    end_hour: number;
    slot_min: number;
    is_regular_session: boolean;
  };
  /** 참여자별 응답 슬롯. 이름은 받지 않는다 — 문구에 쓰지 않는다. */
  slots: string[][];
}

/**
 * 이름 없이 추천 계산만 돌리기 위한 최소 뷰.
 * recommendBlocks는 slots와 responded만 보고, 나머지 필드는 화면 그릴 때만 쓴다.
 */
function toAnonymousViews(slots: string[][]): ParticipantView[] {
  return slots.map((slot, index) => ({
    id: String(index),
    name: "",
    initial: "",
    color: "",
    avatarPath: null,
    responded: true,
    slots: new Set(normalizeSlots(slot)),
  }));
}

export function allRespondedMessage(claim: AllRespondedClaim, siteUrl: string): string {
  const { poll } = claim;
  const total = claim.slots.length;
  const times = pollTimes(poll.start_hour, poll.end_hour, poll.slot_min);
  const recommendations = recommendBlocks(
    poll.dates,
    times,
    toAnonymousViews(claim.slots),
    poll.slot_min,
    2,
    poll.is_regular_session ? REGULAR_SESSION_MIN_BLOCK_MIN : MIN_BLOCK_MIN,
  );

  const lines = [
    `✅ [스케줄] "${poll.title}" 전원 응답이 끝났어요 (${total}/${total}명)`,
    "이제 일정을 확정해주세요.",
  ];

  if (recommendations.length > 0) {
    lines.push("", "가장 많이 겹치는 시간");
    recommendations.forEach((recommendation, index) => {
      const when = `${dateWithWeekday(dayKeyKst(recommendation.startIso))} ${timeAmPm(timeKeyKst(recommendation.startIso))}`;
      const who = recommendation.available.length === total
        ? "전원 가능"
        : `${recommendation.available.length}명 가능`;
      lines.push(`${MEDALS[index]} ${when} · ${durationLabel(recommendation.durationMin)} · ${who}`);
    });
  }

  lines.push("", `<${siteUrl}/schedule/${poll.id}|일정 확정하러 가기>`);
  return lines.join("\n");
}

/**
 * 마지막 한 명까지 응답을 마쳤으면 운영진 채널에 확정 요청을 보낸다.
 *
 * 응답 저장 경로 두 갈래(로그인 응답·초대 링크 응답)가 모두 지나간다.
 * 알림이 실패해도 응답 저장은 이미 끝났으므로 예외를 던지지 않는다.
 *
 * 선점(claim)은 슬랙 설정을 확인한 뒤에 한다 — 먼저 선점하면 설정이 빠져 있을 때
 * 발송권만 태우고 알림은 영영 안 나간다.
 */
async function claimAndSend(
  client: SupabaseClient,
  rpc: string,
  params: Record<string, string>,
): Promise<void> {
  const botToken = process.env.SLACK_JARVIS_BOT_TOKEN;
  const channel = process.env.SLACK_ADMIN_CHANNEL_ID;
  if (!botToken || !channel) return;

  const { data, error } = await client.rpc(rpc, params);
  if (error || !data) return;

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  await postMessage({ channel, botToken, text: allRespondedMessage(data as AllRespondedClaim, siteUrl) });
}

/** 로그인한 참여자가 응답을 저장한 뒤 */
export async function notifyAllResponded(client: SupabaseClient, pollId: string): Promise<void> {
  await claimAndSend(client, "meeting_poll_claim_all_responded", { p_poll: pollId });
}

/** 초대 링크로 들어온 사람이 응답을 저장한 뒤 — 익명이라 폴 id 대신 토큰으로 찾는다 */
export async function notifyAllRespondedByToken(client: SupabaseClient, token: string): Promise<void> {
  await claimAndSend(client, "meeting_poll_claim_all_responded_by_token", { p_token: token });
}
