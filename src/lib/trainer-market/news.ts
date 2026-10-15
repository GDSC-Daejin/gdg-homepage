export const MARKET_SYMBOL_ORDER = ["OAK", "SILPH", "BALL", "ROCKET", "CENTER", "CELADON"] as const;

const angles = {
  OAK: "research",
  SILPH: "technology",
  BALL: "manufacturing",
  ROCKET: "logistics",
  CENTER: "care",
  CELADON: "retail",
} as const;

export type MarketNewsDraft = {
  symbol: string;
  headline: string;
  body: string;
  sentiment: -2 | -1 | 0 | 1 | 2;
  angle: string;
  predecessors: string[];
};

export type MarketStory = {
  title: string;
  summary: string;
  causalChain: string;
  closingNote: string;
};

const sentimentLabel = {
  "-2": "강한 악재 📉",
  "-1": "악재 📉",
  "0": "관망 ⚪",
  "1": "호재 📈",
  "2": "강한 호재 📈",
} as const;

const isSafeText = (value: unknown, min: number, max: number) =>
  typeof value === "string" && value.length >= min && value.length <= max && !/[\r\n@<>]/.test(value);

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

export function isMarketNewsDrafts(value: unknown, expectedSymbols: string[]): value is MarketNewsDraft[] {
  if (!Array.isArray(value) || value.length !== expectedSymbols.length) return false;
  const expected = new Set(expectedSymbols);
  const received = new Set<string>();

  return value.every((news) => {
    if (!news || typeof news !== "object") return false;
    const draft = news as Record<string, unknown>;
    if (typeof draft.symbol !== "string" || !expected.has(draft.symbol) || received.has(draft.symbol)) return false;
    received.add(draft.symbol);
    return isSafeText(draft.headline, 4, 60)
      && isSafeText(draft.body, 10, 300)
      && [-2, -1, 0, 1, 2].includes(draft.sentiment as number)
      && draft.angle === angles[draft.symbol as keyof typeof angles]
      && Array.isArray(draft.predecessors)
      && draft.predecessors.length > 0
      && draft.predecessors.every((predecessor) => predecessor === "story" || expected.has(predecessor as string));
  });
}

export function validateMarketStory(story: MarketStory, news: MarketNewsDraft[]) {
  if (!isSafeText(story.title, 4, 60) || !isSafeText(story.summary, 30, 220) || !isSafeText(story.causalChain, 10, 160) || !isSafeText(story.closingNote, 10, 160)) return false;
  if (story.summary.split(".").filter(Boolean).length < 2 || MARKET_SYMBOL_ORDER.filter((symbol) => story.causalChain.includes(symbol)).length < 3) return false;
  if (!isMarketNewsDrafts(news, [...MARKET_SYMBOL_ORDER])) return false;
  if (news.every((item) => item.sentiment === news[0].sentiment)) return false;
  const headlines = new Set(news.map((item) => normalize(item.headline)));
  const bodies = new Set(news.map((item) => normalize(item.body)));
  const firstSentences = new Set(news.map((item) => normalize(item.body.split(".")[0])));
  return headlines.size === news.length && bodies.size === news.length && firstSentences.size === news.length && news.every((item) => !story.summary.includes(item.body));
}

export function marketNewsBundleMessage(story: MarketStory, news: Array<MarketNewsDraft & { name: string; emoji: string }>) {
  const bySymbol = new Map(news.map((item) => [item.symbol, item]));
  return [
    "📰 *관동 주식 속보 · 10:30*",
    "",
    "*오늘의 사건*",
    story.summary,
    "",
    "*연결 고리*",
    story.causalChain,
    "",
    ...MARKET_SYMBOL_ORDER.flatMap((symbol) => {
      const item = bySymbol.get(symbol)!;
      return [`${item.emoji} *${item.name}* · ${sentimentLabel[item.sentiment]}`, `*${item.headline}*`, item.body, ""];
    }),
  ].join("\n");
}
