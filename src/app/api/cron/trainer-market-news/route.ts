import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasValidCronAuthorization } from "@/lib/cron";
import { marketNewsBundleMessage, type MarketNewsDraft } from "@/lib/trainer-market/news";
import { stockQuantityBlocks } from "@/lib/trainer-market/blocks";
import { postMessage } from "@/lib/slack/api";

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
const newsImagePath: Record<string, string | undefined> = {
  SILPH: "/trainer-market/news/silph.png",
  BALL: "/trainer-market/news/ball.png",
  CENTER: "/trainer-market/news/center.png",
  CELADON: "/trainer-market/news/celadon.png",
  OAK: "/trainer-market/news/oak.png",
  ROCKET: "/trainer-market/news/rocket.png",
};

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
    .select("id, symbol, headline, body, sentiment")
    .eq("market_date", today())
    .is("posted_at", null)
    .lte("publish_at", new Date().toISOString())
    .order("publish_at")
    .limit(6);
  if (!news?.length) return NextResponse.json({ posted: false, reason: "nothing_due" });
  if (news.length !== 6) return NextResponse.json({ error: "오늘의 뉴스 수가 올바르지 않아요" }, { status: 500 });

  const [{ data: symbols }, { data: config }] = await Promise.all([
    supabase.from("trainer_market_symbols").select("symbol, name_ko, emoji").in("symbol", news.map((item) => item.symbol)),
    supabase.from("squirtle_config").select("channel_id").eq("id", 1).maybeSingle(),
  ]);
  if (!symbols || symbols.length !== 6 || !config?.channel_id) return NextResponse.json({ error: "종목 또는 게시 채널 설정이 없어요" }, { status: 500 });

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
    return { ...item, name: symbol.name_ko, emoji: symbol.emoji, sentiment: item.sentiment as MarketNewsDraft["sentiment"] };
  });
  const text = marketNewsBundleMessage(marketNews);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const blocks = [
    { type: "section", text: { type: "mrkdwn", text } },
    ...marketNews.flatMap((item) => {
      const imagePath = newsImagePath[item.symbol];
      return siteUrl && imagePath ? [{ type: "image", image_url: `${siteUrl}${imagePath}`, alt_text: `${item.name} 관련 이미지` }] : [];
    }),
    ...news.flatMap((item) => stockQuantityBlocks(item.symbol)),
  ];
  const posted = await postMessage({ channel: config.channel_id, text, blocks, botToken: process.env.TRAINER_SLACK_BOT_TOKEN });
  if (!posted.ok) {
    await supabase.from("trainer_market_news").update({ posting_at: null }).in("id", news.map((item) => item.id));
    return NextResponse.json({ error: posted.error, posted: false }, { status: 502 });
  }
  await supabase.from("trainer_market_news").update({ posted_at: new Date().toISOString(), posting_at: null, message_ts: posted.ts }).in("id", news.map((item) => item.id));
  return NextResponse.json({ posted: true, symbols: news.map((item) => item.symbol) });
}
