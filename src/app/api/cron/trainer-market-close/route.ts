import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasValidCronAuthorization } from "@/lib/cron";
import { closeBriefing } from "@/lib/trainer-market/messages";
import { postMessage } from "@/lib/slack/api";

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !hasValidCronAuthorization(request.headers.get("authorization"), secret)) return NextResponse.json({ error: "권한이 없어요" }, { status: 401 });
  if (!url || !key) return NextResponse.json({ error: "Supabase 서비스 롤 연동이 설정되지 않았어요" }, { status: 500 });
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: bot } = await supabase.from("bots").select("active").eq("slug", "trainer_market").maybeSingle();
  if (!bot?.active) return NextResponse.json({ posted: false, reason: "disabled" });
  const { error: closeError } = await supabase.rpc("trainer_close_market");
  if (closeError) return NextResponse.json({ error: "시장을 마감하지 못했어요" }, { status: 500 });
  const date = today();
  const { data: config } = await supabase.from("squirtle_config").select("channel_id").eq("id", 1).maybeSingle();
  const { data: claimed } = await supabase.from("trainer_markets").update({ close_message_ts: "pending" }).eq("market_date", date).is("close_message_ts", null).select("close_briefing").maybeSingle();
  if (!claimed) return NextResponse.json({ posted: false, reason: "already_posted" });
  if (!config?.channel_id) {
    await supabase.from("trainer_markets").update({ close_message_ts: null }).eq("market_date", date);
    return NextResponse.json({ error: "게시 채널 설정이 없어요" }, { status: 500 });
  }
  const posted = await postMessage({ channel: config.channel_id, text: closeBriefing((claimed.close_briefing ?? {}) as Parameters<typeof closeBriefing>[0]), botToken: process.env.TRAINER_SLACK_BOT_TOKEN });
  if (!posted.ok) {
    await supabase.from("trainer_markets").update({ close_message_ts: null }).eq("market_date", date);
    return NextResponse.json({ error: posted.error, posted: false }, { status: 502 });
  }
  await supabase.from("trainer_markets").update({ close_message_ts: posted.ts }).eq("market_date", date);
  return NextResponse.json({ posted: true });
}
