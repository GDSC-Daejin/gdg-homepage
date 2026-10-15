import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateMarketStory, type MarketNewsDraft } from "@/lib/trainer-market/news";

const pool = readFileSync("supabase/migrations/0107_trainer_market_news_pool.sql", "utf8");
const extras = readFileSync("supabase/migrations/0108_trainer_market_six_news.sql", "utf8");
const angles: Record<string, string> = { OAK: "research", SILPH: "technology", BALL: "manufacturing", ROCKET: "logistics", CENTER: "care", CELADON: "retail" };
const predecessors: Record<string, string[]> = { OAK: ["story"], SILPH: ["OAK"], BALL: ["SILPH"], ROCKET: ["SILPH"], CENTER: ["ROCKET"], CELADON: ["CENTER"] };

type Entry = { symbol: string; headline: string; body: string; sentiment: -2 | -1 | 0 | 1 | 2 };

const stories = [...pool.matchAll(/\((\d+), '((?:[^']|'')*)', '(\[[\s\S]*?\])'::jsonb\)/g)].map(([, offset, summary, json]) => ({
  offset: Number(offset),
  summary: summary.replace(/''/g, "'"),
  entries: JSON.parse(json.replace(/''/g, "'")) as Entry[],
}));
const extrasByOffset = new Map([...extras.matchAll(/\((\d+), '([^']+)', '([^']+)', '([^']+)', (-?\d+)\)/g)].map(([, offset, symbol, headline, body, sentiment]) => [Number(offset), { symbol, headline, body, sentiment: Number(sentiment) as Entry["sentiment"] }]));

describe("트레이너 마켓 에피소드 풀", () => {
  it("기존 30일 협곡 서사는 중복 없는 여섯 종목 기사로 변환된다", () => {
    expect(stories).toHaveLength(30);
    expect(extrasByOffset.size).toBe(30);

    for (const story of stories) {
      const articles = [...story.entries, extrasByOffset.get(story.offset)!].map((item) => ({
        ...item,
        body: `${item.body}${story.entries.includes(item) ? "" : " 현장 운영 계획에 반영됐어요."}`.replace(`${story.summary} `, "").replace(" 현장 운영 계획에 반영됐어요.", ""),
        angle: angles[item.symbol],
        predecessors: predecessors[item.symbol],
      })) as MarketNewsDraft[];
      expect(validateMarketStory({ title: story.summary.split(".")[0].slice(0, 60), summary: story.summary, causalChain: "OAK → SILPH → BALL·ROCKET → CENTER·CELADON", closingNote: "오늘의 현장 변화가 장마감 결과에 반영됐어요." }, articles)).toBe(true);
    }
  });
});
