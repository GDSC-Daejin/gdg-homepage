import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasValidCronAuthorization } from "@/lib/cron";
import { addReaction, listUserEmails, postMessage } from "@/lib/slack/api";
import { DAILY_MESSAGES, dailyMessage, seasonEndMessage } from "@/lib/squirtle/messages";
import { matchSlackUsers } from "@/lib/squirtle/backfill";
import type { CloseResult, Stage } from "@/lib/squirtle/types";

export function pickMessageIndex(): number {
  return Math.floor(Math.random() * DAILY_MESSAGES.length);
}

type ServiceClient = SupabaseClient;

async function backfillSlackIds(supabase: ServiceClient) {
  const { data: unlinked } = await supabase.from("profiles").select("id").is("slack_user_id", null);
  if (!unlinked || unlinked.length === 0) return 0;
  const slackEmails = await listUserEmails();
  if (slackEmails.size === 0) return 0;

  const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const unlinkedIds = new Set(unlinked.map((row) => row.id as string));
  const members = (users?.users ?? []).filter((user) => unlinkedIds.has(user.id)).map((user) => ({ id: user.id, email: user.email ?? "" }));
  const matches = matchSlackUsers(slackEmails, members);
  for (const match of matches) {
    await supabase.from("profiles").update({ slack_user_id: match.slack_user_id }).eq("id", match.id);
  }
  return matches.length;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET이 설정되지 않았어요" }, { status: 401 });
  if (!hasValidCronAuthorization(request.headers.get("authorization"), cronSecret)) {
    return NextResponse.json({ error: "권한이 없어요" }, { status: 401 });
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase 서비스 롤 연동이 설정되지 않았어요" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 꺼진 봇은 시즌 마감도 보너스 지급도 하지 않는다 — 반드시 마감보다 먼저 확인한다
  const { data: bot } = await supabase.from("bots").select("active").eq("slug", "squirtle").single();
  if (!bot?.active) return NextResponse.json({ posted: false, reason: "disabled" });

  const { data: config } = await supabase.from("squirtle_config").select("channel_id, emoji, bonus_first, bonus_second, bonus_third").eq("id", 1).single();
  if (!config) return NextResponse.json({ error: "꼬북봇 설정이 없어요" }, { status: 500 });

  const { data: closeData } = await supabase.rpc("squirtle_close_season");
  const closed = closeData as CloseResult | null;
  if (closed?.closed) {
    await postMessage({
      channel: config.channel_id,
      text: seasonEndMessage({
        stage: closed.stage as Stage,
        total: closed.total,
        top3: closed.top3,
        bonuses: [config.bonus_first, config.bonus_second, config.bonus_third] as [number, number, number],
        emoji: config.emoji,
      }),
    });
  }

  const { data: seasonId, error: seasonError } = await supabase.rpc("squirtle_open_season");
  if (seasonError || !seasonId) return NextResponse.json({ error: "시즌을 열지 못했어요" }, { status: 500 });
  const linked = await backfillSlackIds(supabase);
  const posted = await postMessage({ channel: config.channel_id, text: dailyMessage(config.emoji, pickMessageIndex()) });
  if (!posted.ok) return NextResponse.json({ error: posted.error, posted: false }, { status: 502 });

  const { error: insertError } = await supabase.from("squirtle_posts").insert({
    season_id: seasonId,
    posted_on: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }),
    message_ts: posted.ts,
  });
  if (insertError) return NextResponse.json({ posted: false, reason: "already_posted" });
  await addReaction({ channel: config.channel_id, ts: posted.ts, emoji: config.emoji });
  return NextResponse.json({ posted: true, linked, closed: closed?.closed ?? false });
}
