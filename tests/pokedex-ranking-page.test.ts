import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RankingLeagueTab } from "@/app/(member)/pokedex/page";

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
});
