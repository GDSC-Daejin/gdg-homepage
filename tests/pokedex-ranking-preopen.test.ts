import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { isRankingLeagueOpen, RANKING_LEAGUE_OPEN_AT } from "@/lib/pokedex/ranking-open";

describe("랭킹전 프리오픈", () => {
  it("회원 랭킹전은 독립 경로를 쓰고, 기존 도감 랭킹 주소는 그 경로로 보낸다", async () => {
    const [open, page, layout, ranking] = await Promise.all([
      readFile("src/lib/pokedex/ranking-open.ts", "utf8"),
      readFile("src/app/(member)/pokedex/page.tsx", "utf8"),
      readFile("src/app/(member)/pokedex/ranking/layout.tsx", "utf8"),
      readFile("src/app/ranking/page.tsx", "utf8"),
    ]);

    expect(open).toContain("RANKING_LEAGUE_PREOPEN = true");
    expect(open).toContain(`RANKING_LEAGUE_OPEN_AT = "${RANKING_LEAGUE_OPEN_AT}"`);
    expect(page).toContain('if (requestedTab === "ranking") redirect("/ranking")');
    expect(layout).toContain('if (!isRankingLeagueOpen()) redirect("/ranking")');
    expect(ranking).toContain('import { RankingPreview } from "../ranking-preview/RankingPreview"');
    expect(ranking).toContain("await requireProfile()");
    expect(ranking).toContain('supabase.rpc("pokedex_rank_state")');
    expect(ranking).toContain("profile={profile}");
  });

  it("목요일 12시 전에는 프리오픈, 정각부터 정식 오픈한다", () => {
    expect(isRankingLeagueOpen(new Date("2026-09-24T02:59:59.999Z"))).toBe(false);
    expect(isRankingLeagueOpen(new Date("2026-09-24T03:00:00.000Z"))).toBe(true);
  });
});
