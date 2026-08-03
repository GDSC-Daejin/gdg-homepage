import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  isDemoMode: vi.fn(),
  requireProfile: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/demo", () => ({ isDemoMode: mocks.isDemoMode }));
vi.mock("@/lib/auth", () => ({ requireProfile: mocks.requireProfile }));

import PokedexPage, { RankingLeagueTab } from "@/app/(member)/pokedex/page";

function query(data: unknown) {
  const result = Promise.resolve({ data });
  return { select: () => query(data), eq: () => query(data), order: () => query(data), maybeSingle: () => result, returns: () => result, then: result.then.bind(result) };
}

beforeEach(() => {
  mocks.createClient.mockResolvedValue({ from: () => query([]), rpc: () => Promise.resolve({ data: [] }) });
  mocks.isDemoMode.mockResolvedValue(false);
  mocks.requireProfile.mockResolvedValue({ id: "member" });
});

describe("도감 랭킹전 탭", () => {
  it("오픈 전에는 포켓몬 그림과 랭킹전 준비 규칙을 안내한다", () => {
    const page = renderToStaticMarkup(createElement(RankingLeagueTab, { profileId: "member", state: null }));
    const text = page.replace(/<br\/?>(?=.)/g, " ").replace(/<[^>]+>/g, "");

    expect(text).toContain("추후 오픈 예정");
    expect(text).toContain("서로 다른 포켓몬 6종을 모아요");
    expect(text).toContain("공격 팀과 방어 팀을 만들어요");
    expect(text).toContain("하루에 최대 3번 공격할 수 있어요");
    expect(text).toContain("점수는 이렇게 바뀌어요");
    expect(page).toContain('alt="피카츄"');
    expect(page).not.toContain("참전하기");
  });

  it("오픈 전 랭킹 탭은 Supabase 조회를 시작하지 않는다", async () => {
    await PokedexPage({ searchParams: Promise.resolve({ tab: "ranking" }) });

    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
