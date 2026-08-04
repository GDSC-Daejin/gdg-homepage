import type { RankingBattleSummary, RankingLeagueState } from "./ranking-league";

/** 시즌은 모두 1,000점에서 시작한다 (도감 랭킹전 설계 "시즌·기록"). */
export const RANKING_START_RATING = 1_000;
/** 시즌 보상(1~3위 트로피·뱃지)을 받으려면 필요한 최소 전적. */
export const RANKING_REWARD_MIN = { matches: 10, attacks: 5 };
export const RANKING_ATTACKS_PER_DAY = 3;
/** 일일 상대와 방어 덱 반영 기준 시각 (KST). */
export const RANKING_REFRESH_HOUR = 6;

const HOUR = 60 * 60 * 1_000;
const KST_OFFSET = 9 * HOUR;

export function battleDelta(battle: RankingBattleSummary) {
  return battle.role === "attacker" ? battle.attackerDelta : battle.defenderDelta;
}

export function battleWon(battle: RankingBattleSummary, profileId: string) {
  return battle.winnerId === profileId;
}

/**
 * 저장된 전투 기록의 점수 변동을 거꾸로 되짚어 시즌 점수 추이를 복원한다.
 * 별도 스냅샷 테이블 없이 pokemon_rank_battles만으로 계산한다.
 * 반환값은 오래된 순이며, 첫 점은 시즌 시작 점수다.
 */
export function rankingScoreSeries(battles: RankingBattleSummary[], currentRating: number) {
  const ordered = [...battles].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let rating = ordered.reduce((value, battle) => value - battleDelta(battle), currentRating);
  const series = [{ createdAt: null as string | null, rating }];
  for (const battle of ordered) {
    rating += battleDelta(battle);
    series.push({ createdAt: battle.createdAt, rating });
  }
  return series;
}

/** 공격·방어를 나눈 전적과 최고 연승. 연승은 공격·방어를 합쳐 시간순으로 센다. */
export function rankingRecord(battles: RankingBattleSummary[], profileId: string) {
  const ordered = [...battles].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const tally = { attack: { wins: 0, losses: 0 }, defense: { wins: 0, losses: 0 } };
  let streak = 0;
  let bestStreak = 0;
  for (const battle of ordered) {
    const side = battle.role === "attacker" ? tally.attack : tally.defense;
    if (battleWon(battle, profileId)) {
      side.wins += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      side.losses += 1;
      streak = 0;
    }
  }
  const defenseTotal = tally.defense.wins + tally.defense.losses;
  return {
    ...tally,
    bestStreak,
    defenseWinRate: defenseTotal === 0 ? null : Math.round((tally.defense.wins / defenseTotal) * 100),
  };
}

/** 최근 24시간 안에 치른 방어전 요약. 방어전이 없으면 null. */
export function recentDefense(battles: RankingBattleSummary[], profileId: string, now: number) {
  const since = now - 24 * HOUR;
  const recent = battles.filter((battle) => battle.role === "defender" && new Date(battle.createdAt).getTime() >= since);
  if (recent.length === 0) return null;
  const wins = recent.filter((battle) => battleWon(battle, profileId)).length;
  return { wins, losses: recent.length - wins, delta: recent.reduce((total, battle) => total + battleDelta(battle), 0) };
}

/** 시즌 보상 자격까지 남은 전적. */
export function rewardProgress(entry: NonNullable<RankingLeagueState["entry"]>) {
  const matchesLeft = Math.max(0, RANKING_REWARD_MIN.matches - entry.matches);
  const attacksLeft = Math.max(0, RANKING_REWARD_MIN.attacks - entry.attacks);
  return { matchesLeft, attacksLeft, eligible: matchesLeft === 0 && attacksLeft === 0 };
}

/** 3위 안에 들기까지 남은 점수. 이미 3위 안이거나 참가자가 3명 미만이면 null. */
export function gapToPodium(leaderboard: RankingLeagueState["leaderboard"], rating: number, myRank: number | null) {
  if (myRank !== null && myRank <= 3) return null;
  const third = leaderboard.find((member) => member.rank === 3) ?? leaderboard[leaderboard.length - 1];
  if (!third || leaderboard.length < 3) return null;
  return Math.max(0, third.rating - rating + 1);
}

/** 시즌 진행률(%)과 남은 일수. */
export function seasonProgress(season: RankingLeagueState["season"], now: number) {
  const start = new Date(season.startsAt).getTime();
  const end = new Date(season.endsAt).getTime();
  const span = end - start;
  return {
    percent: span <= 0 ? 100 : Math.round(Math.min(100, Math.max(0, ((now - start) / span) * 100))),
    daysLeft: Math.max(0, Math.ceil((end - now) / (24 * HOUR))),
  };
}

/** 다음 상대 갱신(매일 KST 06:00)까지 남은 시간을 hh:mm:ss로 만든다. */
export function timeUntilRefresh(now: number) {
  const kst = new Date(now + KST_OFFSET);
  const next = new Date(kst);
  next.setUTCHours(RANKING_REFRESH_HOUR, 0, 0, 0);
  if (next.getTime() <= kst.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  const left = next.getTime() - kst.getTime();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(left / HOUR))}:${pad(Math.floor(left / 60_000) % 60)}:${pad(Math.floor(left / 1_000) % 60)}`;
}

export function signedScore(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

/** 프리셋은 3마리까지만 담긴다. 이미 3마리면 더 담기지 않고, 같은 걸 누르면 빠진다. */
export function toggleRankingPresetMember(throwIds: string[], throwId: string) {
  if (throwIds.includes(throwId)) return throwIds.filter((id) => id !== throwId);
  return throwIds.length === 3 ? throwIds : [...throwIds, throwId];
}
