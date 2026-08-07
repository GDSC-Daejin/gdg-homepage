import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySlackSignature } from "@/lib/slack/verify";
import { addReaction, postMessage, updateMessage } from "@/lib/slack/api";
import { acceptedEmojis, stageEmoji } from "@/lib/squirtle/emoji";
import { evolutionMessage, threadSummary } from "@/lib/squirtle/messages";
import type { CheckinResult, Stage } from "@/lib/squirtle/types";

type ReactionEvent = { type?: string; user?: string; reaction?: string; item?: { ts?: string } };

export function shouldProcess(event: ReactionEvent, config: { emojis: string[]; botUserId: string }): boolean {
  if (event.type !== "reaction_added") return false;
  if (!event.reaction || !config.emojis.includes(event.reaction)) return false;
  if (!event.user || event.user === config.botUserId) return false;
  if (!event.item?.ts) return false;
  return true;
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function handleReaction(event: ReactionEvent) {
  const supabase = serviceClient();
  if (!supabase) return;
  const { data: config } = await supabase.from("squirtle_config").select("channel_id, emoji, emoji_stage2, emoji_stage3, stage2_threshold, stage3_threshold").eq("id", 1).single();
  if (!config) return;
  if (!shouldProcess(event, { emojis: acceptedEmojis(config), botUserId: process.env.SLACK_BOT_USER_ID ?? "" })) return;

  const messageTs = event.item!.ts!;
  const { data, error } = await supabase.rpc("squirtle_checkin", { p_slack_user: event.user, p_message_ts: messageTs });
  if (error) return;
  const result = data as CheckinResult;
  if (!result.counted) return;

  const { data: post } = await supabase.from("squirtle_posts").select("thread_ts").eq("message_ts", messageTs).single();
  const text = threadSummary({ participants: result.participants, total: result.total, stage: result.stage, stage2Threshold: config.stage2_threshold, stage3Threshold: config.stage3_threshold, emoji: stageEmoji(config, result.stage) });
  if (!text) return;

  if (post?.thread_ts) {
    const updated = await updateMessage({ channel: config.channel_id, ts: post.thread_ts, text });
    if (!updated.ok && updated.error === "message_not_found") {
      await supabase.from("squirtle_posts").update({ thread_ts: null }).eq("message_ts", messageTs);
    }
  } else {
    const created = await postMessage({ channel: config.channel_id, text, threadTs: messageTs });
    if (created.ok) await supabase.from("squirtle_posts").update({ thread_ts: created.ts }).eq("message_ts", messageTs);
  }

  if (result.stage_changed) {
    // 오늘 메시지에는 이전 단계 씨앗만 달려 있다. 새 이모지를 봇이 먼저 달아줘야
    // 남은 사람들이 이모지 검색창을 열지 않고 한 번 탭으로 인증할 수 있다.
    const before = stageEmoji(config, (result.stage - 1) as Stage);
    const now = stageEmoji(config, result.stage);
    let seeded: string | undefined;
    if (now !== before) {
      const reacted = await addReaction({ channel: config.channel_id, ts: messageTs, emoji: now });
      // 씨앗을 못 달았으면 안내도 하지 않는다 — 못 누르는 이모지를 누르라고 하는 꼴이 된다
      if (reacted.ok || reacted.error === "already_reacted") seeded = now;
    }
    await postMessage({
      channel: config.channel_id,
      text: evolutionMessage({ stage: result.stage as Stage, total: result.total, top3: result.top3, participantCount: result.participants.length, nextEmoji: seeded }),
    });
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return Response.json({ error: "not_configured" }, { status: 500 });
  const valid = verifySlackSignature({ rawBody, timestamp: request.headers.get("x-slack-request-timestamp"), signature: request.headers.get("x-slack-signature"), signingSecret });
  if (!valid) return Response.json({ error: "invalid_signature" }, { status: 401 });

  let payload: { type?: string; challenge?: string; event?: ReactionEvent };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (payload.type === "url_verification") return Response.json({ challenge: payload.challenge });
  if (payload.event) {
    const event = payload.event;
    after(async () => {
      try {
        await handleReaction(event);
      } catch {
        // 스레드 표시는 다음 리액션 때 자동 정정된다 — 재시도하지 않는다
      }
    });
  }
  return Response.json({ ok: true });
}
