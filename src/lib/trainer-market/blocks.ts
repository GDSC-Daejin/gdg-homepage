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
  return [actions(button("10TP", "trainer_game_amount_10", "10"), button("50TP", "trainer_game_amount_50", "50"), button("100TP", "trainer_game_amount_100", "100"))];
}

export function homeBlocks(): SlackBlock[] {
  return [actions(button("📟 출석", "trainer_home_checkin", "checkin"), button("🎲 게임코너", "trainer_home_game", "game"), button("🏪 프렌들리숍", "trainer_home_shop", "shop"), button("📈 주식 매수권", "trainer_home_card", "card"))];
}

export function gameGuessBlocks(stake: number): SlackBlock[] {
  return [actions(button("⚡ 홀", "trainer_game_guess_odd", `${stake}:odd`), button("🔵 짝", "trainer_game_guess_even", `${stake}:even`))];
}

export function shopBlocks(): SlackBlock[] {
  return [actions(button("1개 · 200TP", "trainer_shop_1", "1"), button("2개 · 400TP", "trainer_shop_2", "2"), button("3개 · 600TP", "trainer_shop_3", "3"))];
}

export function stockQuantityBlocks(symbol: string): SlackBlock[] {
  return [
    actions(button("1장 · 100TP", "trainer_stock_1", `${symbol}:1`), button("2장 · 200TP", "trainer_stock_2", `${symbol}:2`), button("3장 · 300TP", "trainer_stock_3", `${symbol}:3`)),
    actions(button("최근 7일 추이", "trainer_stock_trend", symbol)),
  ];
}

export function marketBlocks(quotes: Quote[], intro?: string): SlackBlock[] {
  const rows: SlackBlock[] = [];
  for (let index = 0; index < quotes.length; index += 3) {
    rows.push(...quotes.slice(index, index + 3).map((quote) => actions(button(`${quote.emoji} ${quote.name_ko}`, "trainer_stock_symbol", quote.symbol))));
  }
  return [
    ...(intro ? [{ type: "section", text: { type: "mrkdwn", text: `${intro}\n\n응원할 종목을 누른 뒤, 원하는 수량을 선택하세요.\n한 사람당 최대 3개 종목·총 5장까지 살 수 있어요.\n장마감 22:00에 자동 정산됩니다.` } }] : []),
    ...rows,
  ];
}

export function shareGameBlock(betId: string): SlackBlock[] {
  return [actions(button("결과 공개", "trainer_game_share", betId))];
}
