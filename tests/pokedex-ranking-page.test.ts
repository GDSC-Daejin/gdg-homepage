import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  isDemoMode: vi.fn(),
  requireProfile: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/demo", () => ({ isDemoMode: mocks.isDemoMode }));
vi.mock("@/lib/auth", () => ({ requireProfile: mocks.requireProfile }));

import PokedexPage from "@/app/(member)/pokedex/page";
import { RankingLeagueTab } from "@/app/(member)/pokedex/RankingLeagueTab";
import RankingPage from "@/app/ranking/page";

// 정식 오픈(2026-09-24 12:00 KST) 직전. 프리오픈 분기는 실행 시각에 따라 갈리므로 시각을 고정한다.
const BEFORE_OPEN = new Date("2026-09-24T02:59:59.000Z");

function query(data: unknown) {
  const result = Promise.resolve({ data });
  return { select: () => query(data), eq: () => query(data), order: () => query(data), maybeSingle: () => result, returns: () => result, then: result.then.bind(result) };
}

beforeEach(() => {
  mocks.createClient.mockResolvedValue({ from: () => query([]), rpc: mocks.rpc });
  mocks.isDemoMode.mockResolvedValue(false);
  mocks.requireProfile.mockResolvedValue({ id: "member", name: "테스터", nickname: "tester" });
  mocks.rpc.mockReset().mockResolvedValue({ data: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("도감 랭킹전 탭", () => {
  it("랭킹 데이터가 없으면 프리오픈 안내를 보여준다", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BEFORE_OPEN);
    const page = renderToStaticMarkup(createElement(RankingLeagueTab, { profile: { id: "member", name: "테스터", nickname: "tester" }, state: null, comingSoon: null }));
    const text = page.replace(/<br\/?>(?=.)/g, " ").replace(/<[^>]+>/g, "");

    expect(text).toContain("랭킹전 데이터를 불러오지 못했어요.");
  });

  it("프리오픈에도 랭킹전 데이터를 조회한다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BEFORE_OPEN);

    // 기존 도감 랭킹 탭 주소는 독립 랭킹전 경로로 보낸다.
    await expect(PokedexPage({ searchParams: Promise.resolve({ tab: "ranking" }) })).rejects.toMatchObject({ digest: expect.stringContaining(";/ranking;") });

    await RankingPage();

    expect(mocks.createClient).toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("pokedex_rank_state");
  });

  it("확률표에서 포켓몬 이름을 검색한다", async () => {
    mocks.isDemoMode.mockResolvedValue(true);

    const page = await PokedexPage({ searchParams: Promise.resolve({ tab: "probabilities", q: "피카" }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('name="q"');
    expect(markup).toContain('value="피카"');
    expect(markup).toContain("피카츄");
    expect(markup).not.toContain("꼬부기");
  });

  it("확률표 검색 결과가 없으면 안내한다", async () => {
    mocks.isDemoMode.mockResolvedValue(true);

    const page = await PokedexPage({ searchParams: Promise.resolve({ tab: "probabilities", q: "없는포켓몬" }) });

    expect(renderToStaticMarkup(page)).toContain("검색한 포켓몬이 없어요.");
  });

});
