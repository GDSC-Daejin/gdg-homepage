type TrendPrice = { close: number; open: number };

const spark = "▁▂▃▄▅▆▇█";

export function trendMessage(symbol: string, name: string | null, prices: TrendPrice[]) {
  if (!name || prices.length === 0) return `${symbol}의 마감 기록이 아직 없어요.`;
  const closes = prices.map((price) => price.close);
  const low = Math.min(...closes);
  const high = Math.max(...closes);
  const graph = closes.map((price) => spark[Math.round(((price - low) / Math.max(high - low, 1)) * (spark.length - 1))]).join("");
  const change = ((closes.at(-1)! - closes[0]) / closes[0]) * 100;
  const trend = change > 2 ? "상승세" : change < -2 ? "하락세" : "보합";
  const marker = change >= 0 ? "▲" : "▼";
  return `${symbol} · ${name}\n최근 종가 ${closes.at(-1)}TP\n7일 추이 ${graph}\n7일 등락 ${marker} ${Math.abs(change).toFixed(1)}% · ${trend}`;
}

export function gameResultMessage(result: { roll: number; guess: string; stake: number; payout: number; balance: number }) {
  const won = result.payout > 0;
  const choice = result.guess === "odd" ? "홀" : "짝";
  const net = result.payout - result.stake;
  return `⚡ 피카츄 주사위: ${result.roll} · ${choice}\n${won ? `적중! ${result.stake}TP를 걸어 ${result.payout}TP를 돌려받았어요. +${net}TP` : `아쉽게 빗나갔어요. -${result.stake}TP`} · 현재 ${result.balance}TP`;
}

export function closeBriefing(briefing: { gainer?: { name: string; change: number }; profits?: Array<{ slack_user_id: string; amount: number; symbols: string }>; losses?: Array<{ slack_user_id: string; amount: number; symbols: string }> }) {
  const lines = ["📣 포켓몬 주식 장마감", "📰 포켓몬 주식 저녁 특보 · 오늘의 결과가 확정됐어요. 내일 시가는 오늘 종가에서 이어집니다."];
  if (briefing.gainer) lines.push(`오늘의 큰 움직임: ${briefing.gainer.name} ${briefing.gainer.change >= 0 ? "+" : ""}${briefing.gainer.change}%`);
  if (briefing.profits?.length) lines.push("💰 오늘의 수익", ...briefing.profits.map((row, index) => `${index + 1}. <@${row.slack_user_id}> +${row.amount}TP · ${row.symbols}`));
  if (briefing.losses?.length) lines.push("📉 오늘의 손실", ...briefing.losses.map((row, index) => `${index + 1}. <@${row.slack_user_id}> ${row.amount}TP · ${row.symbols}`));
  return lines.join("\n");
}
