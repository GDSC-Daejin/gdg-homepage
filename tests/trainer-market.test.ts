import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gameAmountBlocks, homeBlocks, marketBlocks, shopBlocks, stockQuantityBlocks } from "@/lib/trainer-market/blocks";
import { trendMessage } from "@/lib/trainer-market/messages";
import { isMarketNewsDrafts, marketNewsBundleMessage, marketNewsMessage, type MarketNewsDraft } from "@/lib/trainer-market/news";

const migration = readFileSync("supabase/migrations/0104_trainer_market.sql", "utf8");
const startAllMigration = readFileSync("supabase/migrations/0105_trainer_market_start_all.sql", "utf8");
const newsMigration = readFileSync("supabase/migrations/0106_trainer_market_news.sql", "utf8");
const newsPoolMigration = readFileSync("supabase/migrations/0107_trainer_market_news_pool.sql", "utf8");
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
    expect(stockQuantityBlocks("SILPH")[0]).toMatchObject({ type: "actions" });
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

  it("활성 회원 모두에게 시작 TP를 한 번 지급한다", () => {
    expect(startAllMigration).toContain("amount, reason)\nselect id, 500, 'signup'");
    expect(startAllMigration).toContain("status = 'active' and role <> 'applicant'");
  });

  it("AI 뉴스 형식은 보존하고, 기본값은 한 달 뉴스 풀을 사용한다", () => {
    const news = ["SILPH", "BALL", "CENTER", "CELADON", "OAK"].map((symbol, index) => ({ symbol, headline: `${symbol} 새 소식`, body: "현장에 도착한 트레이너들 사이에서 새로운 소식이 빠르게 퍼지고 있어요.", sentiment: [2, 1, 0, -1, -2][index] }));
    expect(isMarketNewsDrafts(news, ["SILPH", "BALL", "CENTER", "CELADON", "OAK"])).toBe(true);
    expect(isMarketNewsDrafts([...news, news[0]], ["SILPH", "BALL", "CENTER", "CELADON", "OAK"])).toBe(false);
    expect(marketNewsMessage({ ...news[0], sentiment: 2, name: "실프 주식회사", emoji: "🧪" })).toContain("*강한 호재 📈*");
    expect(marketNewsBundleMessage(news.map((item, index) => ({ ...item, name: item.symbol, emoji: "🧪", sentiment: [2, 1, 0, -1, -2][index] as MarketNewsDraft["sentiment"] })))).toContain("*SILPH*");
    expect(newsMigration).toContain("trainer_market_news");
    expect(newsMigration).toContain("금빛시티 백화점");
    expect(newsRoute).toContain("trainer-market/news/silph.png");
    expect(newsPoolMigration).toContain("trainer_market_news_pool");
    expect(newsPoolMigration).toContain("(29,");
    expect(marketOpenRoute).toContain('TRAINER_MARKET_AI_NEWS === "true"');
    expect(marketOpenRoute).toContain('from("trainer_market_news_pool")');
    expect(marketOpenRoute).toContain("poolNews.length !== 6");
    expect(newsRoute).toContain("news.length !== 6");
  });
});
