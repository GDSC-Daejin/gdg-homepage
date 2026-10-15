import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasValidCronAuthorization } from "@/lib/cron";
import { marketNewsBundleMessage, type MarketNewsDraft, type MarketStory, validateMarketStory } from "@/lib/trainer-market/news";
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

  const { data: news } = await supabase
    .from("trainer_market_news")
    .select("id, symbol, headline, body, sentiment, angle, predecessors")
    .eq("market_date", today())
    .is("posted_at", null)
    .lte("publish_at", new Date().toISOString())
    .order("publish_at")
    .limit(6);
  if (!news?.length) return NextResponse.json({ posted: false, reason: "nothing_due" });
  if (news.length !== 6) return NextResponse.json({ error: "오늘의 뉴스 수가 올바르지 않아요" }, { status: 500 });

  const [{ data: symbols }, { data: market }, { data: config }] = await Promise.all([
    supabase.from("trainer_market_symbols").select("symbol, name_ko, emoji").in("symbol", news.map((item) => item.symbol)),
    supabase.from("trainer_markets").select("story_title, story_summary, story_causal_chain, story_closing_note").eq("market_date", today()).maybeSingle(),
    supabase.from("squirtle_config").select("channel_id").eq("id", 1).maybeSingle(),
  ]);
  if (!symbols || symbols.length !== 6 || !market?.story_title || !market.story_summary || !market.story_causal_chain || !market.story_closing_note || !config?.channel_id) return NextResponse.json({ error: "종목 또는 게시 채널 설정이 없어요" }, { status: 500 });

  const staleAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: claimed } = await supabase
    .from("trainer_market_news")
    .update({ posting_at: new Date().toISOString() })
    .in("id", news.map((item) => item.id))
    .is("posted_at", null)
    .or(`posting_at.is.null,posting_at.lt.${staleAt}`)
    .select("id")
  if (!claimed || claimed.length !== 6) {
    if (claimed?.length) await supabase.from("trainer_market_news").update({ posting_at: null }).in("id", claimed.map((item) => item.id));
    return NextResponse.json({ posted: false, reason: "being_posted" });
  }

  const symbolsByCode = new Map(symbols.map((symbol) => [symbol.symbol, symbol]));
  const marketNews = news.map((item) => {
    const symbol = symbolsByCode.get(item.symbol)!;
    return { ...item, name: symbol.name_ko, emoji: symbol.emoji, sentiment: item.sentiment as MarketNewsDraft["sentiment"], predecessors: item.predecessors as string[] };
  });
  const story: MarketStory = { title: market.story_title, summary: market.story_summary, causalChain: market.story_causal_chain, closingNote: market.story_closing_note };
  if (!validateMarketStory(story, marketNews)) {
    await supabase.from("trainer_market_news").update({ posting_at: null }).in("id", news.map((item) => item.id));
    return NextResponse.json({ error: "오늘의 주식 속보 구성이 올바르지 않아요" }, { status: 500 });
  }
  const text = marketNewsBundleMessage(story, marketNews);
  const blocks = [{ type: "section", text: { type: "mrkdwn", text } }];
  const posted = await postMessage({ channel: config.channel_id, text, blocks, botToken: process.env.TRAINER_SLACK_BOT_TOKEN });
  if (!posted.ok) {
    await supabase.from("trainer_market_news").update({ posting_at: null }).in("id", news.map((item) => item.id));
    return NextResponse.json({ error: posted.error, posted: false }, { status: 502 });
  }
  await supabase.from("trainer_market_news").update({ posted_at: new Date().toISOString(), posting_at: null, message_ts: posted.ts }).in("id", news.map((item) => item.id));
  return NextResponse.json({ posted: true, symbols: news.map((item) => item.symbol) });
}
