import { describe, expect, it } from "vitest";
import { ownershipRankingMessage } from "@/lib/pokedex/messages";
import { pokemonOwnershipRanking } from "@/lib/pokedex/ranking";

describe("포켓몬 보유 랭킹", () => {
  it("같은 포켓몬 중복 포획은 한 종으로 세고, 동점은 총 포획 수로 정렬한다", () => {
    expect(
      pokemonOwnershipRanking(
        [
          { userId: "a", pokemonId: "1" },
          { userId: "a", pokemonId: "1" },
          { userId: "a", pokemonId: "2" },
          { userId: "b", pokemonId: "3" },
          { userId: "b", pokemonId: "4" },
          { userId: "b", pokemonId: "5" },
        ],
        new Map([
          ["a", "UA"],
          ["b", "UB"],
        ]),
      ),
    ).toEqual([
      { slackUserId: "UB", speciesCount: 3, totalCatches: 3 },
      { slackUserId: "UA", speciesCount: 2, totalCatches: 3 },
    ]);
  });

  it("상위 세 명을 슬랙 멘션으로 안내한다", () => {
    expect(
      ownershipRankingMessage([
        { slackUserId: "U1", speciesCount: 7, totalCatches: 8 },
        { slackUserId: "U2", speciesCount: 5, totalCatches: 5 },
      ]),
    ).toContain("1위 <@U1> · 7종 보유");
  });
});
