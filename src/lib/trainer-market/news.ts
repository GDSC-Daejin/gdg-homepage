export type MarketNewsDraft = {
  symbol: string;
  headline: string;
  body: string;
  sentiment: -2 | -1 | 0 | 1 | 2;
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

export function isMarketNewsDrafts(value: unknown, expectedSymbols: string[]): value is MarketNewsDraft[] {
  if (!Array.isArray(value) || value.length !== expectedSymbols.length) return false;
  const expected = new Set(expectedSymbols);
  const received = new Set<string>();

  return value.every((news) => {
    if (!news || typeof news !== "object") return false;
    const draft = news as Record<string, unknown>;
    if (typeof draft.symbol !== "string" || !expected.has(draft.symbol) || received.has(draft.symbol)) return false;
    received.add(draft.symbol);
    return isSafeText(draft.headline, 4, 60) && isSafeText(draft.body, 30, 300) && [-2, -1, 0, 1, 2].includes(draft.sentiment as number);
  });
}

export function marketNewsMessage(news: MarketNewsDraft & { name: string; emoji: string }) {
  return [
    "📰 *포켓몬 주식 속보*",
    `${news.emoji} *${news.name}*`,
    "",
    `*${news.headline}*`,
    news.body,
    "",
    "━━━━━━━━━━━━",
    `오늘 흐름 · *${sentimentLabel[news.sentiment]}*`,
  ].join("\n");
}

export function marketNewsBundleMessage(news: Array<MarketNewsDraft & { name: string; emoji: string }>) {
  return [
    "📰 *포켓몬 주식 속보*",
    ...news.flatMap((item) => [`${item.emoji} *${item.name}* · ${sentimentLabel[item.sentiment]}`, `*${item.headline}*`, item.body, ""]),
  ].join("\n");
}
