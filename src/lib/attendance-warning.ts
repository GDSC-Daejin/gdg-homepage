import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAttendanceWarnings } from "@/lib/attendance-stats";
import { postMessage } from "@/lib/slack/api";
import { ATTENDANCE_WARNING_THRESHOLD } from "@/app/admin/attendance/constants";
import type { AttendanceReads } from "@/lib/community/types";

export interface WarningSendResult {
  error?: string;
  count: number;
  /** 오늘 이미 보내서 건너뛴 경우 */
  skipped?: boolean;
}

/**
 * 출석 경고 명단을 운영진 전용 프라이빗 채널로 하루 한 번만 보낸다.
 *
 * 이름과 출석률이 그대로 담기는 명단이라 공개 채널에 묶인 SLACK_WEBHOOK_URL은 쓰지 않는다.
 * 프라이빗 채널은 웹훅으로 못 보내므로 봇 토큰(chat.postMessage)을 쓴다 — 봇을 채널에 초대해야 한다.
 * 운영진 알림은 Jarvis(SLACK_JARVIS_BOT_TOKEN) 이름으로 나간다. 꼬북봇 토큰으로 폴백하지 않는다 —
 * 폴백하면 운영 공지가 조용히 꼬북봇 이름을 달고 나간다.
 *
 * 어드민 수동 버튼과 주간 크론이 함께 쓴다. 두 경로가 같은 함수를 지나야 채널도 중복 방지도 갈라지지 않는다.
 */
export async function sendAttendanceWarnings(
  reads: AttendanceReads,
  client: SupabaseClient,
): Promise<WarningSendResult> {
  const warnings = await computeAttendanceWarnings(reads);
  if (warnings.length === 0) return { count: 0 };

  const channel = process.env.SLACK_ADMIN_CHANNEL_ID;
  if (!channel) {
    return { error: "운영진 슬랙 채널이 설정되지 않았어요 (SLACK_ADMIN_CHANNEL_ID)", count: 0 };
  }

  const botToken = process.env.SLACK_JARVIS_BOT_TOKEN;
  if (!botToken) {
    return { error: "운영진 봇 토큰이 설정되지 않았어요 (SLACK_JARVIS_BOT_TOKEN)", count: 0 };
  }

  // 보내기 전에 오늘 자리를 먼저 예약한다. 수동 버튼과 크론이 겹쳐도 sent_on 유일 제약에서 하나만 통과한다.
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const { error: reserveError } = await client
    .from("attendance_warning_sends")
    .insert({ sent_on: today, count: warnings.length });

  if (reserveError) {
    if (reserveError.code === "23505") return { count: 0, skipped: true };
    return { error: "발송 기록을 남기지 못했어요", count: 0 };
  }

  const percent = Math.round(ATTENDANCE_WARNING_THRESHOLD * 100);
  const lines = warnings.map((w) => `- ${w.name} (${Math.round(w.rate * 100)}%)`).join("\n");
  const result = await postMessage({
    channel,
    botToken,
    text: `[출석 경고] 출석률 ${percent}% 미만 회원 ${warnings.length}명\n${lines}`,
  });

  if (!result.ok) {
    // 전송 실패 — 예약을 풀어 다음 시도를 막지 않는다
    await client.from("attendance_warning_sends").delete().eq("sent_on", today);
    return { error: `슬랙 전송에 실패했어요 (${result.error})`, count: 0 };
  }

  return { count: warnings.length };
}
