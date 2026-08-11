import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasValidCronAuthorization } from "@/lib/cron";
import { marketBlocks } from "@/lib/trainer-market/blocks";
import { isMarketNewsDrafts } from "@/lib/trainer-market/news";
import { postMessage } from "@/lib/slack/api";

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
const useAiNews = process.env.TRAINER_MARKET_AI_NEWS === "true";

type Symbol = { symbol: string; name_ko: string; emoji: string };

async function createDailyNews({ apiKey, symbols, history, priceHistory }: { apiKey: string; symbols: Symbol[]; history: unknown; priceHistory: unknown }) {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      contents: [{ parts: [{ text: `당신은 포켓몬 세계의 경제 속보를 쓰는 한국어 편집자다. 주어진 포켓몬 기업을 각각 한 번씩 다루는 신선한 장중 뉴스 JSON 배열을 작성해라. 회사명과 JSON symbol은 반드시 주어진 값을 그대로 쓴다. headline은 4~60자 한 문장, body는 30~300자 두 문장이다. sentiment는 -2(강한 악재), -1(악재), 0(관망), 1(호재), 2(강한 호재) 중 하나이며 기사 내용과 분명히 맞아야 한다. 현실 기업·인물·가격·투자 조언을 언급하지 말고, 포켓몬 세계관의 연구소·체육관·상점·탐사·물류 같은 현장감 있는 사건으로 쓴다. Slack 멘션, 링크, 꺾쇠괄호, 줄바꿈은 쓰지 마라. 과거 기사와 같은 사건을 반복하지 마라.\n\n오늘 종목: ${JSON.stringify(symbols)}\n\n최근 뉴스: ${JSON.stringify(history)}\n\n최근 종가: ${JSON.stringify(priceHistory)}` }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              symbol: { type: "STRING" },
              headline: { type: "STRING" },
              body: { type: "STRING" },
              sentiment: { type: "INTEGER" },
            },
            required: ["symbol", "headline", "body", "sentiment"],
          },
        },
      },
    }),
  });
  if (!response.ok) throw new Error("Gemini가 뉴스를 만들지 못했어요");
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini 응답이 비어 있어요");
  const news: unknown = JSON.parse(text);
  if (!isMarketNewsDrafts(news, symbols.map((symbol) => symbol.symbol))) throw new Error("Gemini 응답 형식이 올바르지 않아요");
  return news;
}

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
  const { count: existingNews } = await supabase.from("trainer_market_news").select("id", { count: "exact", head: true }).eq("market_date", date);
  if (!existingNews) {
    if (useAiNews) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았어요" }, { status: 500 });
      const [{ data: symbols }, { data: history }, { data: priceHistory }] = await Promise.all([
        supabase.from("trainer_market_symbols").select("symbol, name_ko, emoji").order("symbol"),
        supabase.from("trainer_market_news").select("market_date, symbol, headline, sentiment").lt("market_date", date).order("market_date", { ascending: false }).limit(25),
        supabase.from("trainer_market_prices").select("market_date, symbol, open_price, close_price").lt("market_date", date).not("close_price", "is", null).order("market_date", { ascending: false }).limit(42),
      ]);
      if (!symbols || symbols.length !== 6) return NextResponse.json({ error: "뉴스를 만들 종목이 올바르지 않아요" }, { status: 500 });
      try {
        const news = await createDailyNews({ apiKey, symbols, history: history ?? [], priceHistory: priceHistory ?? [] });
        const { error } = await supabase.from("trainer_market_news").insert(news.map((item) => ({ ...item, market_date: date, publish_at: new Date(`${date}T10:30:00+09:00`).toISOString() })));
        if (error) return NextResponse.json({ error: "뉴스를 저장하지 못했어요" }, { status: 500 });
      } catch {
        return NextResponse.json({ error: "Gemini가 오늘의 뉴스를 만들지 못했어요" }, { status: 502 });
      }
    } else {
      const { data: poolNews } = await supabase.from("trainer_market_news_pool").select("symbol, headline, body, sentiment, publish_order").eq("market_date", date).order("publish_order");
      if (!poolNews || poolNews.length !== 6) return NextResponse.json({ error: "오늘의 뉴스 풀이 준비되지 않았어요" }, { status: 500 });
      const { error } = await supabase.from("trainer_market_news").insert(poolNews.map(({ publish_order: _publishOrder, ...item }) => ({ ...item, market_date: date, publish_at: new Date(`${date}T10:30:00+09:00`).toISOString() })));
      if (error) return NextResponse.json({ error: "뉴스를 저장하지 못했어요" }, { status: 500 });
    }
  } else if (existingNews !== 6) {
    return NextResponse.json({ error: "오늘의 뉴스 수가 올바르지 않아요" }, { status: 500 });
  }
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
