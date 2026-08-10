import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasValidCronAuthorization } from "@/lib/cron";
import { marketBlocks } from "@/lib/trainer-market/blocks";
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
  const { error: openError } = await supabase.rpc("trainer_open_market");
  if (openError) return NextResponse.json({ error: "시장을 열지 못했어요" }, { status: 500 });
  const date = today();
  const { data: config } = await supabase.from("squirtle_config").select("channel_id").eq("id", 1).maybeSingle();
  const { data: claimed } = await supabase.from("trainer_markets").update({ open_message_ts: "pending" }).eq("market_date", date).is("open_message_ts", null).select("morning_news").maybeSingle();
  if (!claimed) return NextResponse.json({ posted: false, reason: "already_posted" });
  const { data: prices } = await supabase.from("trainer_market_prices").select("symbol, open_price, trainer_market_symbols!inner(name_ko, emoji)").eq("market_date", date).order("symbol");
  const quotes = (prices ?? []).map((row) => {
    const symbol = row.trainer_market_symbols as unknown as { name_ko: string; emoji: string };
    return { symbol: row.symbol, open_price: row.open_price, ...symbol };
  });
  const text = `📰 포켓몬 주식 아침 속보 · 09:00\n${claimed.morning_news}\n\n📈 포켓몬 주식 · 장중 09:00~22:00\n${quotes.map((quote) => `${quote.emoji} ${quote.name_ko} ${quote.open_price}TP`).join(" · ")}`;
  if (!config?.channel_id) {
    await supabase.from("trainer_markets").update({ open_message_ts: null }).eq("market_date", date);
    return NextResponse.json({ error: "게시 채널 설정이 없어요" }, { status: 500 });
  }
  const posted = await postMessage({ channel: config.channel_id, text, blocks: marketBlocks(quotes, text), botToken: process.env.TRAINER_SLACK_BOT_TOKEN });
  if (!posted.ok) {
    await supabase.from("trainer_markets").update({ open_message_ts: null }).eq("market_date", date);
    return NextResponse.json({ error: posted.error, posted: false }, { status: 502 });
  }
  await supabase.from("trainer_markets").update({ open_message_ts: posted.ts }).eq("market_date", date);
  return NextResponse.json({ posted: true, quotes: quotes.length });
}
