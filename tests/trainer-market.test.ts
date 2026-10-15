import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gameAmountBlocks, homeBlocks, marketBlocks, shopBlocks, stockQuantityBlocks } from "@/lib/trainer-market/blocks";
import { closeBriefing, trendMessage } from "@/lib/trainer-market/messages";
import { isMarketNewsDrafts, marketNewsBundleMessage, validateMarketStory, type MarketNewsDraft } from "@/lib/trainer-market/news";

const migration = readFileSync("supabase/migrations/0104_trainer_market.sql", "utf8");
const startAllMigration = readFileSync("supabase/migrations/0105_trainer_market_start_all.sql", "utf8");
const newsMigration = readFileSync("supabase/migrations/0106_trainer_market_news.sql", "utf8");
const newsPoolMigration = readFileSync("supabase/migrations/0107_trainer_market_news_pool.sql", "utf8");
const priceMigration = readFileSync("supabase/migrations/0109_trainer_market_current_price.sql", "utf8");
const storyMigration = readFileSync("supabase/migrations/0110_trainer_market_story_news.sql", "utf8");
const actionsRoute = readFileSync("src/app/api/slack/trainer/actions/route.ts", "utf8");
const newsRoute = readFileSync("src/app/api/cron/trainer-market-news/route.ts", "utf8");
const marketOpenRoute = readFileSync("src/app/api/cron/trainer-market-open/route.ts", "utf8");

describe("트레이너 마켓봇", () => {
  it("TP 원장, 장중 제한, 중복 방지와 구매 볼 보존을 마이그레이션에 둔다", () => {
    for (const required of ["trainer_point_logs", "trainer_game_bets", "trainer_market_picks", "interaction_id text not null unique", "pg_advisory_xact_lock", "quantity = greatest(pokemon_ball_inventory.quantity, 3)", "time '09:00'", "time '22:00'"]) {
      expect(migration).toContain(required);
    }
  });

  it("슬랙은 입력 대신 수량 버튼과 7일 추이를 제공한다", () => {
    expect(gameAmountBlocks()[0]).toMatchObject({ type: "actions" });
    expect(shopBlocks()[0]).toMatchObject({ type: "actions" });
    expect(stockQuantityBlocks("SILPH", 150)[0]).toMatchObject({ type: "actions" });
    expect(marketBlocks([{ symbol: "BALL", name_ko: "몬스터볼 팩토리", emoji: "🏭", open_price: 100 }])[0]).toMatchObject({ type: "actions" });
    expect(homeBlocks()[0]).toMatchObject({ type: "actions" });
    expect(JSON.stringify(homeBlocks())).not.toContain("trainer_home_start");
    expect(JSON.stringify(homeBlocks())).toContain("프렌들리숍");
    expect(JSON.stringify(homeBlocks())).toContain("주식 매수권");
    expect(trendMessage("SILPH", "실프 주식회사", [{ open: 100, close: 100 }, { open: 100, close: 106 }])).toContain("상승세");
  });

  it("버튼 요청은 즉시 확인하고 결과는 response_url로 보낸다", () => {
    expect(actionsRoute).toContain("after(async () =>");
    expect(actionsRoute).toContain("fetch(responseUrl");
  });

  it("응원권은 당일 시가로 사고 종가로 정산한다", () => {
    expect(JSON.stringify(stockQuantityBlocks("SILPH", 150))).toContain("2장 · 300TP");
    expect(priceMigration).toContain("v_stake := p_quantity * v_price");
    expect(priceMigration).toContain("values (v_user, v_today, p_symbol, p_quantity, v_stake, p_interaction_id)");
    expect(priceMigration).toContain("v_pick.stake * ((v_pick.close_price - v_pick.open_price)::numeric / v_pick.open_price)");
    expect(actionsRoute).toContain("stockQuantityBlocks(action.value, quote.open_price)");
  });

  it("활성 회원 모두에게 시작 TP를 한 번 지급한다", () => {
    expect(startAllMigration).toContain("amount, reason)\nselect id, 500, 'signup'");
    expect(startAllMigration).toContain("status = 'active' and role <> 'applicant'");
  });

  it("속보는 에피소드 한 건과 역할이 다른 여섯 기사로 구성한다", () => {
    const story = { title: "협곡 자기장 관측", summary: "붉은 협곡 북부 통로에서 예측 불가 자기장이 감지됐어요. 탐사대는 남쪽 우회로를 열기로 했어요.", causalChain: "OAK → SILPH → BALL·ROCKET → CENTER·CELADON", closingNote: "우회로 운영 결과가 오늘 종가에 반영됐어요." };
    const news: MarketNewsDraft[] = [
      { symbol: "OAK", headline: "자기장 경계선 확정", body: "연구진이 통행 가능 구간을 정해 탐사 재개 기준을 제시했어요.", sentiment: 2, angle: "research", predecessors: ["story"] },
      { symbol: "SILPH", headline: "우회 신호 현장 시험", body: "안전선 안에서만 작동하는 임시 신호 장치를 설치했어요.", sentiment: 0, angle: "technology", predecessors: ["OAK"] },
      { symbol: "BALL", headline: "보호 상자 재포장", body: "출고 물량을 우회 운송 규격으로 다시 묶으며 작업이 늘었어요.", sentiment: -1, angle: "manufacturing", predecessors: ["SILPH"] },
      { symbol: "ROCKET", headline: "남쪽 집하장 증편", body: "우회 물량에 맞춰 야간 운송 계약을 추가로 확보했어요.", sentiment: 1, angle: "logistics", predecessors: ["SILPH"] },
      { symbol: "CENTER", headline: "대기 회복 부스 확대", body: "우회 대기 시간이 길어진 트레이너를 위한 회복 부스를 열었어요.", sentiment: 0, angle: "care", predecessors: ["ROCKET"] },
      { symbol: "CELADON", headline: "체험 예약 일괄 연기", body: "북부 통로 일정이 불확실해 주말 체험 상품의 날짜를 바꿨어요.", sentiment: -1, angle: "retail", predecessors: ["CENTER"] },
    ];
    expect(isMarketNewsDrafts(news, ["OAK", "SILPH", "BALL", "ROCKET", "CENTER", "CELADON"])).toBe(true);
    expect(validateMarketStory(story, news)).toBe(true);
    expect(validateMarketStory(story, [{ ...news[0], symbol: "SILPH", angle: "technology" }, ...news.slice(1)])).toBe(false);
    const message = marketNewsBundleMessage(story, news.map((item) => ({ ...item, name: item.symbol, emoji: "🧪" })));
    expect(message).toContain("*오늘의 사건*");
    expect(closeBriefing({ closingNote: story.closingNote })).toContain(story.closingNote);
    expect(newsMigration).toContain("trainer_market_news");
    expect(newsMigration).toContain("금빛시티 백화점");
    expect(newsPoolMigration).toContain("trainer_market_news_pool");
    expect(newsPoolMigration).toContain("(29,");
    expect(storyMigration).toContain("trainer_market_story_pool");
    expect(storyMigration).toContain("story_summary");
    expect(storyMigration).toContain("insert into trainer_market_news");
    expect(marketOpenRoute).toContain("trainer_open_market");
    expect(marketOpenRoute).not.toContain("GEMINI_API_KEY");
    expect(newsRoute).toContain("news.length !== 6");
    expect(newsRoute).toContain("validateMarketStory");
    expect(newsRoute).not.toContain("stockQuantityBlocks");
    expect(newsRoute).not.toContain("type: \"image\"");
  });
});
