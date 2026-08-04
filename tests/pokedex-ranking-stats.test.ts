import { describe, expect, it } from "vitest";
import type { RankingBattleSummary } from "@/lib/pokedex/ranking-league";
import {
  RANKING_START_RATING,
  battleDelta,
  gapToPodium,
  rankingRecord,
  rankingScoreSeries,
  recentDefense,
  rewardProgress,
  seasonProgress,
  signedScore,
  timeUntilRefresh,
} from "@/lib/pokedex/ranking-stats";

const ME = "me";
const HOUR = 60 * 60 * 1_000;

function battle(overrides: Partial<RankingBattleSummary> & { createdAt: string }): RankingBattleSummary {
  return {
    id: overrides.createdAt,
    role: "attacker",
    opponentName: "랭킹 트레이너",
    opponentNickname: null,
    winnerId: ME,
    attackerDelta: 30,
    defenderDelta: -10,
    ...overrides,
  };
}

const LOG: RankingBattleSummary[] = [
  battle({ createdAt: "2026-08-03T00:12:00.000Z" }),
  battle({ createdAt: "2026-08-02T12:40:00.000Z", role: "defender", winnerId: "rival" }),
  battle({ createdAt: "2026-08-02T11:05:00.000Z", role: "defender", attackerDelta: -30, defenderDelta: 10 }),
  battle({ createdAt: "2026-08-01T09:31:00.000Z", winnerId: "rival", attackerDelta: -30, defenderDelta: 10 }),
];

describe("랭킹전 파생 지표", () => {
  it("공격전은 attackerDelta, 방어전은 defenderDelta를 내 점수 변동으로 쓴다", () => {
    expect(battleDelta(LOG[0])).toBe(30);
    expect(battleDelta(LOG[1])).toBe(-10);
    expect(battleDelta(LOG[2])).toBe(10);
    expect(battleDelta(LOG[3])).toBe(-30);
  });

  it("전투 기록의 점수 변동을 거꾸로 되짚어 시즌 점수 추이를 만든다", () => {
    const series = rankingScoreSeries(LOG, 1_000);
    expect(series).toHaveLength(LOG.length + 1);
    expect(series[0].createdAt).toBeNull();
    // 시작 1,000 → -30 → +10 → -10 → +30 = 1,000
    expect(series.map((point) => point.rating)).toEqual([1_000, 970, 980, 970, 1_000]);
    expect(series[series.length - 1].rating).toBe(1_000);
  });

  it("전투가 없으면 추이는 현재 점수 한 점뿐이다", () => {
    expect(rankingScoreSeries([], 1_000)).toEqual([{ createdAt: null, rating: 1_000 }]);
  });

  it("공격·방어 전적과 최고 연승을 시간순으로 센다", () => {
    const record = rankingRecord(LOG, ME);
    expect(record.attack).toEqual({ wins: 1, losses: 1 });
    expect(record.defense).toEqual({ wins: 1, losses: 1 });
    // 시간순: 패(공격) → 승(방어) → 패(방어) → 승(공격)
    expect(record.bestStreak).toBe(1);
    expect(record.defenseWinRate).toBe(50);
  });

  it("방어전이 없으면 방어 승률은 null이다", () => {
    expect(rankingRecord([LOG[0]], ME).defenseWinRate).toBeNull();
  });

  it("최근 24시간 방어전만 모아 요약한다", () => {
    const now = Date.parse("2026-08-03T01:00:00.000Z");
    expect(recentDefense(LOG, ME, now)).toEqual({ wins: 1, losses: 1, delta: 0 });
    expect(recentDefense(LOG, ME, now + 48 * HOUR)).toBeNull();
  });

  it("시즌 보상 조건까지 남은 전적을 센다", () => {
    const entry = { rating: 1_000, matches: 4, attacks: 2, attacksToday: 0, wins: 2, activeDefenseSlot: null, activeAttackSlot: null, defenseEffectiveOn: null, rerolled: false, rank: 7 };
    expect(rewardProgress(entry)).toEqual({ matchesLeft: 6, attacksLeft: 3, eligible: false });
    expect(rewardProgress({ ...entry, matches: 12, attacks: 9 })).toEqual({ matchesLeft: 0, attacksLeft: 0, eligible: true });
  });

  it("3위 안이면 남은 점수를 계산하지 않는다", () => {
    const board = [
      { rank: 1, userId: "a", name: "a", nickname: null, rating: 1_260 },
      { rank: 2, userId: "b", name: "b", nickname: null, rating: 1_180 },
      { rank: 3, userId: "c", name: "c", nickname: null, rating: 1_120 },
    ];
    expect(gapToPodium(board, 1_060, 7)).toBe(61);
    expect(gapToPodium(board, 1_000, 7)).toBe(121);
    expect(gapToPodium(board, 1_300, 1)).toBeNull();
    expect(gapToPodium(board.slice(0, 2), 1_000, 5)).toBeNull();
  });

  it("시즌 진행률과 남은 일수를 계산한다", () => {
    const season = { id: "s", startsAt: "2026-07-20T21:00:00.000Z", endsAt: "2026-08-17T21:00:00.000Z" };
    expect(seasonProgress(season, Date.parse("2026-07-20T21:00:00.000Z"))).toEqual({ percent: 0, daysLeft: 28 });
    expect(seasonProgress(season, Date.parse("2026-08-17T21:00:00.000Z"))).toEqual({ percent: 100, daysLeft: 0 });
    expect(seasonProgress(season, Date.parse("2026-08-03T21:00:00.000Z")).daysLeft).toBe(14);
  });

  it("다음 상대 갱신(KST 06:00)까지 남은 시간을 hh:mm:ss로 만든다", () => {
    // KST 05:00 = UTC 20:00 전날
    expect(timeUntilRefresh(Date.parse("2026-08-02T20:00:00.000Z"))).toBe("01:00:00");
    // KST 06:00 정각이면 다음 날까지 24시간
    expect(timeUntilRefresh(Date.parse("2026-08-02T21:00:00.000Z"))).toBe("24:00:00");
  });

  it("점수 변동에 부호를 붙인다", () => {
    expect(signedScore(30)).toBe("+30");
    expect(signedScore(-30)).toBe("-30");
    expect(signedScore(0)).toBe("0");
  });

  it("시즌 시작 점수는 1,000점이다", () => {
    expect(RANKING_START_RATING).toBe(1_000);
  });
});
