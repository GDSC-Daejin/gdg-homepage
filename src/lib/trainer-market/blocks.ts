import type { SlackBlock } from "@/lib/slack/api";

type Quote = { symbol: string; name_ko: string; emoji: string; open_price: number };

const button = (text: string, actionId: string, value: string): SlackBlock => ({
  type: "button",
  text: { type: "plain_text", text, emoji: true },
  action_id: actionId,
  value,
});

const actions = (...elements: SlackBlock[]): SlackBlock => ({ type: "actions", elements });

export function gameAmountBlocks(): SlackBlock[] {
  return [actions(button("10TP", "trainer_game_amount", "10"), button("50TP", "trainer_game_amount", "50"), button("100TP", "trainer_game_amount", "100"))];
}

export function homeBlocks(): SlackBlock[] {
  return [actions(button("📟 출석", "trainer_home_checkin", "checkin"), button("🎲 게임코너", "trainer_home_game", "game"), button("🏪 프렌들리숍", "trainer_home_shop", "shop"), button("📈 주식 매수권", "trainer_home_card", "card"))];
}

export function gameGuessBlocks(stake: number): SlackBlock[] {
  return [actions(button("⚡ 홀", "trainer_game_guess", `${stake}:odd`), button("🔵 짝", "trainer_game_guess", `${stake}:even`))];
}

export function shopBlocks(): SlackBlock[] {
  return [actions(button("1개 · 200TP", "trainer_shop", "1"), button("2개 · 400TP", "trainer_shop", "2"), button("3개 · 600TP", "trainer_shop", "3"))];
}

export function stockQuantityBlocks(symbol: string): SlackBlock[] {
  return [
    actions(button("1장 · 100TP", "trainer_stock", `${symbol}:1`), button("2장 · 200TP", "trainer_stock", `${symbol}:2`), button("3장 · 300TP", "trainer_stock", `${symbol}:3`)),
    actions(button("최근 7일 추이", "trainer_stock_trend", symbol)),
  ];
}

export function marketBlocks(quotes: Quote[]): SlackBlock[] {
  const rows: SlackBlock[] = [];
  for (let index = 0; index < quotes.length; index += 3) {
    rows.push(actions(...quotes.slice(index, index + 3).map((quote) => button(`${quote.emoji} ${quote.name_ko}`, "trainer_stock_symbol", quote.symbol))));
  }
  return rows;
}

export function shareGameBlock(betId: string): SlackBlock[] {
  return [actions(button("결과 공개", "trainer_game_share", betId))];
}
